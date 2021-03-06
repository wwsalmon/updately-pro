import {NextApiRequest, NextApiResponse} from "next";
import {getSession} from "next-auth/client";
import dbConnect from "../../utils/dbConnect";
import {UserModel} from "../../models/user";
import {SnippetModel} from "../../models/snippet";
import {PostModel} from "../../models/post";
import {differenceInWeeks} from "date-fns";
import {getIsActive} from "../admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "GET") return res.status(405).json({message: "wrong method"});
    const session = await getSession({req});
    if (!session || session.user.email !== "wwsamson12309@gmail.com") return res.status(403).json({message: "unauthed"});

    try {
        await dbConnect();

        const users = await UserModel.aggregate([
            {
                $lookup: {
                    from: "posts",
                    let: {"userId": "$_id"},
                    pipeline: [
                        {$match: {$expr: {$eq: ["$userId", "$$userId"]}}},
                        {$project: {"createdAt": 1, "linkedPosts": 1}},
                    ],
                    as: "postsArr",
                }
            },
            {
                $lookup: {
                    from: "snippets",
                    let: {"userId": "$_id"},
                    pipeline: [
                        {$match: {$expr: {$eq: ["$userId", "$$userId"]}}},
                        {$project: {"createdAt": 1}},
                    ],
                    as: "snippetsArr",
                }
            },
            {
                $lookup: {
                    from: "projects",
                    let: {"userId": "$_id"},
                    pipeline: [
                        {$match: {$expr: {$eq: ["$userId", "$$userId"]}}},
                        {$project: {"createdAt": 1}},
                    ],
                    as: "projects",
                }
            },
            {$project: {"name": 1, "email": 1, "username": 1, "image": 1, "createdAt": 1, "postsArr": 1, "snippetsArr": 1, "projects": 1}}
        ]);

        const snippetTexts = await SnippetModel.aggregate([
            {$project: {"body": 1, "userId": 1}}
        ]);

        const postTexts = await PostModel.aggregate([
            {$project: {"body": 1, "userId": 1}}
        ]);

        const getBodyLengths = (itemArr: {body: string}[]) => itemArr.reduce((a, b) => a + (b.body ? b.body.split(" ").length : 0), 0);

        const snippetTextLength = getBodyLengths(snippetTexts);
        const postTextLength = getBodyLengths(postTexts);

        const weeklyActiveUsers = users.filter(d => d.username !== "samsonzhang" && !!getIsActive(d, 7));
        let weeksElapsed = 0;
        let wordsWritten = 0;
        let snippetsWritten = 0;
        let postsWritten = 0;
        for (let user of weeklyActiveUsers) {
            weeksElapsed += differenceInWeeks(new Date(), new Date(user.createdAt));
            const thisUserPosts = postTexts.filter(d => d.userId.toString() === user._id.toString());
            const thisUserSnippets = snippetTexts.filter(d => d.userId.toString() === user._id.toString());
            wordsWritten += getBodyLengths([...thisUserPosts, ...thisUserSnippets]);
            postsWritten += thisUserPosts.length;
            snippetsWritten += thisUserSnippets.length;
        }
        const wordsPerWeek = wordsWritten / weeksElapsed;
        const snippetsPerWeek = snippetsWritten / weeksElapsed;
        const postsPerWeek = postsWritten / weeksElapsed;

        return res.status(200).json({data: users, wordCount: snippetTextLength + postTextLength, wordsPerWeek: wordsPerWeek, snippetsPerWeek: snippetsPerWeek, postsPerWeek: postsPerWeek});
    } catch (e) {
        return res.status(500).json({message: e});
    }
}