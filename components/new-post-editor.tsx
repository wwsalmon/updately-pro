import React, {Dispatch, SetStateAction, useEffect, useState} from "react";
import MDEditor from "./md-editor";
import SpinnerButton from "./spinner-button";
import {DatedObj, ProjectObj, UserObj} from "../utils/types";
import Select from "react-select";
import AsyncCreatableSelect from "react-select/async-creatable";
import axios from "axios";
import EasyMDE from "easymde";
import {Node, Element} from "slate";
import SlateEditor from "./SlateEditor";

export default function NewPostEditor(props: {
    body?: string,
    slateBody?: Node[],
    title?: string,
    postId?: string,
    privacy?: "public" | "unlisted" | "private",
    tags?: string[],
    tempId: string,
    startProjectId: string,
    projects: {projects: DatedObj<ProjectObj>[]},
    sharedProjects: {projects: DatedObj<ProjectObj>[], owners: DatedObj<UserObj>[] },
    onSaveEdit: (projectId: string, title: string, body: string | Node[], privacy: "public" | "unlisted" | "private", tags: string[], isSlate: boolean) => void,
    onCancelEdit: () => void,
    getProjectLabel: (projectId: string) => string,
    isEditLoading: boolean,
    setInstance: Dispatch<SetStateAction<EasyMDE>>,
}) {
    const [body, setBody] = useState<string>(props.body);
    const [slateBody, setSlateBody] = useState<Node[]>(props.slateBody || [{
        // @ts-ignore doesn't recognize "type" property in Node
        type: "p",
        children: [{text: ""}],
        id: 0,
    }]);
    const [title, setTitle] = useState<string>(props.title);
    const [projectId, setProjectId] = useState<string>(props.startProjectId);
    const [privacy, setPrivacy] = useState<"public" | "unlisted" | "private">(props.privacy || "public");
    const [tags, setTags] = useState<string[]>(props.tags || []);

    const privacyOptions = [
        {
            label: "Public (appears on profile)",
            value: "public",
        },
        {
            label: "Unlisted (link accessible, but doesn't appear on profile)",
            value: "unlisted",
        },
        {
            label: "Private (not accessible by non-collaborators)",
            value: "private",
        },
    ];

    function promiseOptions(inputValue, cb) {
        axios.get(`/api/tag?query=${inputValue}`).then(res => {
            cb(res.data.tags.map(d => ({label: d.key, value: d.key})));
        }).catch(e => console.log(e));
    }

    useEffect(() => {
        window.onbeforeunload = !!body ? () => true : undefined;

        return () => {
            window.onbeforeunload = undefined;
        };
    }, [!!body]);

    return (
        <>
            <input
                type="text"
                className="w-full up-h1 h-16 mb-4"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Add a title"
            />
            <div className="content prose w-full" style={{maxWidth: "unset", minHeight: 300}}>
                {/* if post being edited has slateBody or if new post */}
                {(slateBody || !props.title) ? (
                    <SlateEditor
                        body={slateBody}
                        setBody={setSlateBody}
                        projectId={projectId}
                        urlName={props.tempId}
                        isPost={true}
                    />
                ) : (
                    <MDEditor
                        body={body}
                        setBody={setBody}
                        imageUploadEndpoint={`/api/upload?projectId=${projectId}&attachedType=post&attachedUrlName=${props.tempId}`}
                        placeholder="Turn your snippets into a shareable post!"
                        id={projectId + (props.postId || "new")}
                        setInstance={props.setInstance}
                    />
                )}
            </div>

            <hr className="my-8"/>
            <div className="flex -mx-4 w-full">
                <div className="mx-4 w-1/2">
                    <h3 className="up-ui-title mb-4">Project</h3>
                    <Select
                        options={[
                            ...((props.projects && props.projects.projects && props.projects.projects.length > 0) ? props.projects.projects.map(project => ({
                                value: project._id,
                                label: props.getProjectLabel(project._id),
                            })) : []),
                            ...((props.sharedProjects && props.sharedProjects.projects && props.sharedProjects.projects.length > 0) ? props.sharedProjects.projects.map(project => ({
                                value: project._id,
                                label: props.getProjectLabel(project._id),
                            })) : []),
                        ]}
                        value={{
                            value: projectId,
                            label:props.getProjectLabel(projectId)
                        }}
                        onChange={option => setProjectId(option.value)}
                        styles={{
                            menu: provided => ({...provided, zIndex: 6}),
                        }}
                    />
                </div>
                <div className="mx-4 w-1/2">
                    <h3 className="up-ui-title mb-4">Visibility</h3>
                    <Select
                        options={privacyOptions}
                        value={privacyOptions.find(d => d.value === privacy)}
                        onChange={option => setPrivacy(option.value)}
                        styles={{
                            menu: provided => ({...provided, zIndex: 6}),
                        }}
                    />
                </div>
            </div>

            <div className="my-8">
                <h3 className="up-ui-title mb-4">Tags</h3>
                <AsyncCreatableSelect
                    isMulti
                    cacheOptions
                    defaultOptions
                    loadOptions={promiseOptions}
                    value={tags.map(d => ({label: d, value: d}))}
                    onChange={newValue => setTags(newValue.map(d => d.value))}
                    styles={{
                        menu: provided => ({...provided, zIndex: 6}),
                    }}
                />
                <p className="opacity-50 mt-4 text-xs text-right">Select an existing tag or type to create a new one</p>
            </div>

            <div className="flex mt-4">
                <SpinnerButton
                    isLoading={props.isEditLoading}
                    onClick={() => props.onSaveEdit(projectId, title, slateBody || body, privacy, tags, !!slateBody)}
                    isDisabled={(!body && (!slateBody || !slateBody.length)) || !title}
                >
                    {props.title ? "Save" : "Post"}
                </SpinnerButton>
                <button className="up-button text" onClick={props.onCancelEdit} disabled={props.isEditLoading}>Cancel</button>
            </div>
        </>
    );
}