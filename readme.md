# Usage

    const { makeExecutableSchema } = require('graphql-tools');
    const extend = require('@major-mann/graphql-tool-directive-extend');

    const schema = makeExecutableSchema({
        typeDefs: `
            type Foo {
                bar: String
            }
        `
    });

    extend({
        schema,
        extensions: `
            type Foo @auth
        `,
        directives: {
            auth: AuthDirective
        }
    });

    // Contains the auth directive
    console.log(schema.getType('Foo').directives);
