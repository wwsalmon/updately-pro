import { renderToStaticMarkup } from 'react-dom/server';
import { createElementWithSlate } from '@udecode/slate-plugins-common';
import {
    SlatePlugin,
    SlateProps,
    SPEditor,
    SPRenderElementProps,
    TDescendant,
} from '@udecode/slate-plugins-core';
import { Text } from 'slate';
import { RenderLeafProps } from 'slate-react';

// Remove extra whitespace generated by ReactDOMServer
const trimWhitespace = (rawHtml: string): string =>
    rawHtml.replace(/(\r\n|\n|\r|\t)/gm, '');

// Remove redundant data attributes
const stripSlateDataAttributes = (rawHtml: string): string =>
    rawHtml
        .replace(/( data-slate)(-node|-type)="[^"]+"/gm, '')
        .replace(/( data-testid)="[^"]+"/gm, '');

/**
 * Remove all class names that do not start with one of preserveClassNames (`slate-` by default)
 */
const stripClassNames = (
    html: string,
    { preserveClassNames = ['slate-'] }: { preserveClassNames?: string[] }
) => {
    const allClasses = html.split(/(class="[^"]*")/g);

    let filteredHtml = '';
    allClasses.forEach((item, index) => {
        if (index % 2 === 0) {
            return (filteredHtml += item);
        }
        const preserveRegExp = new RegExp(
            preserveClassNames.map((cn) => `${cn}[^"\\s]*`).join('|'),
            'g'
        );
        const slateClassNames = item.match(preserveRegExp);
        if (slateClassNames) {
            filteredHtml += `class="${slateClassNames.join(' ')}"`;
        }
    });

    return filteredHtml;
};

const getNode = (
    editor: SPEditor,
    {
        plugins,
        elementProps,
        slateProps,
        preserveClassNames,
    }: {
        plugins: SlatePlugin[];
        elementProps: SPRenderElementProps;
        slateProps?: Partial<SlateProps>;
        preserveClassNames?: string[];
    }
) => {
    // If no type provided we wrap children with div tag
    if (!elementProps.element.type) {
        return `<div>${elementProps.children}</div>`;
    }

    let html: string | undefined;

    // Search for matching plugin based on element type
    plugins.some((plugin) => {
        if (!plugin.serialize?.element && !plugin.renderElement) return false;

        if (
            !plugin
                .deserialize?.(editor)
                .element?.some(
                    (item) => item.type === String(elementProps.element.type)
                )
        ) {
            html = `<div>${elementProps.children}</div>`;
            return false;
        }

        // Render element using picked plugins renderElement function and ReactDOM
        html = renderToStaticMarkup(
            createElementWithSlate({
                ...slateProps,
                children:
                    plugin.serialize?.element?.(elementProps) ??
                    plugin.renderElement?.(editor)(elementProps),
            })
        );

        html = stripClassNames(html, { preserveClassNames });

        return true;
    });

    return html;
};

const getLeaf = (
    editor: SPEditor,
    {
        plugins,
        leafProps,
        slateProps,
        preserveClassNames,
    }: {
        plugins: SlatePlugin[];
        leafProps: RenderLeafProps;
        slateProps?: Partial<SlateProps>;
        preserveClassNames?: string[];
    }
) => {
    const { children } = leafProps;

    return plugins.reduce((result, plugin) => {
        if (!plugin.serialize?.leaf && !plugin.renderLeaf) return result;
        if (
            (plugin.serialize?.leaf?.(leafProps) ??
                plugin.renderLeaf?.(editor)(leafProps)) === children
        )
            return result;

        const newLeafProps = {
            ...leafProps,
            children: encodeURIComponent(result),
        };

        let html = decodeURIComponent(
            renderToStaticMarkup(
                createElementWithSlate({
                    ...slateProps,
                    children:
                        plugin.serialize?.leaf?.(leafProps) ??
                        plugin.renderLeaf?.(editor)(newLeafProps),
                })
            )
        );

        html = stripClassNames(html, { preserveClassNames });

        return html;
    }, children);
};

const isEncoded = (str = '') => {
    try {
        return str !== decodeURIComponent(str);
    } catch (error) {
        return false;
    }
};

const escapeHTML = (str: string) => {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/**
 * Convert Slate Nodes into HTML string
 */
export const customSerializeHTMLFromNodes = (
    editor: SPEditor,
    {
        plugins,
        nodes,
        slateProps,
        stripDataAttributes = true,
        preserveClassNames,
    }: {
        /**
         * Plugins with renderElement or renderLeaf.
         */

        plugins: SlatePlugin[];
        /**
         * Slate nodes to convert to HTML.
         */
        nodes: TDescendant[];

        /**
         * Enable stripping data attributes
         */
        stripDataAttributes?: boolean;

        /**
         * List of className prefixes to preserve from being stripped out
         */
        preserveClassNames?: string[];

        /**
         * Slate props to provide if the rendering depends on slate hooks
         */
        slateProps?: Partial<SlateProps>;
    }
): string => {
    let result = nodes
        .map((node) => {
            if (node.type === "code_block") {
                return encodeURIComponent(`<pre><code>${node.children.map(line => {
                        if ("text" in line) return escapeHTML(line.text) + "\n";
                        if ("children" in line) return escapeHTML(line.children[0].text) + "\n";
                    })}</code></pre>                    
                `);
            }

            if (Text.isText(node)) {
                return trimWhitespace(getLeaf(editor, {
                    plugins,
                    leafProps: {
                        leaf: node,
                        text: node,
                        children: isEncoded(node.text)
                            ? node.text
                            : encodeURIComponent(node.text),
                        attributes: { 'data-slate-leaf': true },
                    },
                    slateProps,
                    preserveClassNames,
                }));
            }

            return trimWhitespace(getNode(editor, {
                plugins,
                elementProps: {
                    element: node,
                    children: encodeURIComponent(
                        customSerializeHTMLFromNodes(editor, {
                            plugins,
                            nodes: node.children,
                            preserveClassNames,
                        })
                    ) as any,
                    attributes: { 'data-slate-node': 'element', ref: null },
                },
                slateProps,
                preserveClassNames,
            }));
        })
        .join('');

    result = decodeURIComponent(result);

    if (stripDataAttributes) {
        result = stripSlateDataAttributes(result);
    }

    return result;
};
