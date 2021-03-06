import type {NextApiRequest, NextApiResponse} from "next";
import {getSession} from "next-auth/client";
import {ProjectModel} from "../../models/project";
import {SnippetModel} from "../../models/snippet";
import {UserModel} from "../../models/user";
import dbConnect from "../../utils/dbConnect";
import * as mongoose from "mongoose";
import {aggregatePipeline} from "../../utils/utils";
import {PostModel} from "../../models/post";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const session = await getSession({ req });

    switch (req.method) {
        case "GET":
            try {
                await dbConnect();

                if (req.query.shared || req.query.userId) {
                    let projects;

                    if (req.query.userId) {
                        const thisUser = await UserModel.findById(req.query.userId);
                        projects = await ProjectModel.aggregate([
                            {
                                $match: {
                                    _id: {$in: thisUser.featuredProjects},
                                },
                            },
                            ...aggregatePipeline,
                        ]);
                    } else {
                        projects = await ProjectModel.aggregate([
                            {
                                $match: { collaborators: new mongoose.Types.ObjectId(session.userId) },
                            },
                            ...aggregatePipeline,
                        ]);
                    }
                    const projectOwners = projects.map(d => d.userId.toString());
                    const uniqueProjectOwners = projectOwners.filter((d, i, a) => a.findIndex(x => x === d) === i);
                    const owners = await UserModel.find({ _id: {$in: uniqueProjectOwners }});
                    res.status(200).json({projects: projects, owners: owners});
                } else {
                    let matchConditions = { userId: new mongoose.Types.ObjectId(session.userId) };
                    if (req.query.search) matchConditions["$text"] = {$search: req.query.search};

                    let paginationConditions = req.query.page ? [
                        {$skip: (+req.query.page - 1) * 10},
                        {$limit: 10},
                    ] : [];

                    const projects = await ProjectModel.aggregate([
                        {
                            $match: matchConditions,
                        },
                        ...aggregatePipeline,
                        ...paginationConditions,
                    ]);

                    const count = await ProjectModel.find(matchConditions).count();

                    res.status(200).json({projects: projects, count: count});
                }

                return;
            } catch (e) {
                return res.status(500).json({message: e});
            }
        case "DELETE":
            if (!session || !session.userId) {
                return res.status(403).json({message: "You must be logged in to access this endpoint."});
            }

            // ensure necessary post params are present
            if (!req.body.id) return res.status(406).json({message: "No project ID found in request."});

            try {
                await dbConnect();

                const thisProject = await ProjectModel.findOne({ _id: req.body.id });

                if (!thisProject) return res.status(406).json({message: "No project found with given ID."});

                if (thisProject.userId.toString() !== session.userId) return res.status(403).json({message: "You do not have permission to delete this snippet."});

                await SnippetModel.deleteMany({ projectId: req.body.id });
                await PostModel.deleteMany({ projectId: req.body.id });
                await ProjectModel.deleteOne({ _id: req.body.id });

                res.status(200).json({message: "Project successfully deleted."});

                return;
            } catch (e) {
                return res.status(500).json({message: e});
            }
        default:
            return res.status(405);
    }
}