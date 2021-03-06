import Link from "next/link";
import React from "react";
import {DatedObj, SnippetObjGraph} from "../utils/types";
import useSWR from "swr";
import {fetcher} from "../utils/utils";
import ellipsize from "ellipsize";

interface SnippetItemLinkPreviewBaseProps {
    small?: boolean,
}

interface SnippetItemLinkPreviewSnippetProps extends SnippetItemLinkPreviewBaseProps {
    snippet: DatedObj<SnippetObjGraph>,
    url?: never,
}

interface SnippetItemLinkPreviewUrlProps extends SnippetItemLinkPreviewBaseProps {
    snippet?: never,
    url: string,
}

type SnippetItemLinkPreviewProps = SnippetItemLinkPreviewSnippetProps | SnippetItemLinkPreviewUrlProps;

export default function SnippetItemLinkPreview({snippet, url, small}: SnippetItemLinkPreviewProps) {
    const thisUrl = url || (snippet && snippet.url);
    
    const {data: linkPreview, error: linkPreviewError} = useSWR(`/api/link-preview?url=${thisUrl}`, (thisUrl) ? fetcher : () => null);

    return (
        <Link href={thisUrl}>
            <a className={small ? "flex mb-2" : "p-4 rounded-md shadow-md mb-8 flex opacity-50 hover:opacity-100 transition w-full"}>
                <div>
                    <p className="opacity-50 break-all">{ellipsize(thisUrl, 50)}</p>
                    {linkPreview && (
                        <div className="mt-2">
                            <p className={small ? "font-bold" : "up-ui-item-title"}>{linkPreview.title}</p>
                            {linkPreview.description && (
                                <p>{ellipsize(linkPreview.description, 140)}</p>
                            )}
                        </div>
                    )}
                </div>
                {linkPreview && linkPreview.images && !!linkPreview.images.length && (
                    <div className={`${small ? "w-16" : "w-24"} ml-auto pl-4 flex-shrink-0`}>
                        <img src={linkPreview.images[0]} className="w-full"/>
                    </div>
                )}
            </a>
        </Link>
    )
}