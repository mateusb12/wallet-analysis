function createRule(context) {
    const source = context.getSourceCode();
    const comments = source.getAllComments();

    for (const comment of comments) {
        context.report({
            node: comment,
            messageId: 'noComment',
            fix: (fixer) => fixer.removeRange(comment.range),
        });
    }

    return {};
}

export default {
    rules: {
        'no-explanatory-comments': {
            meta: {
                type: 'suggestion',
                fixable: 'code',
                docs: {
                    description: 'Remove all comments',
                },
                messages: {
                    noComment: 'CMT001 Do not commit comments',
                },
            },
            create: createRule,
        },
    },
};
