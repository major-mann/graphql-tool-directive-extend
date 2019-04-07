module.exports = extend;
const { parse } = require('graphql');

const merge = require('@major-mann/graphql-tool-merge-ast');

function extend({ schema, extensions, directives, parseOptions, context }) {
    // Merge everything together
    if (Array.isArray(extensions)) {
        extensions = merge({
            onTypeConflict: () => true,
            typeDefs: extensions,
            parseOptions
        });
    }
    if (typeof extensions === 'string') {
        extensions = parse(extensions, parseOptions);
    }

    // Now we are sure we have a document, we can go through all the types defined in the document and do the following:
    //  1. Lookup the existing type using the name
    //  2. Instantiate any directives required
    //  3. Add the directives to the schema
    //  4. Execute the correct visitor according to where we are in the tree walk
    walk(extensions, schema);

    function walk(extension, schema) {
        switch (extension.kind) {
            case 'Document':
                handleDirectives('visitSchema');
                extension.definitions.forEach(definition => walk(definition, schema.getType(nameOf(definition))));
                break;
            case 'ObjectTypeDefinition':
                handleDirectives('visitObject');
                extension.fields.forEach(field => walk(field, schema.getFields()[nameOf(field)]));
                break;
            case 'FieldDefinition':
                handleDirectives('visitFieldDefinition');
                break;
            case 'ScalarTypeDefinition':
                handleDirectives('visitScalar');
                break;
            case 'InterfaceTypeDefinition':
                handleDirectives('visitInterface');
                extension.fields.forEach(field => walk(field, schema.getFields()[nameOf(field)]));
                break;
            case 'InputObjectTypeDefinition':
                handleDirectives('visitInputObject');
                extension.fields.forEach(field => walk(field, schema.getFields()[nameOf(field)]));
                break;
            case 'InputValueDefinition':
                handleDirectives('visitInputFieldDefinition');
                break;
            case 'UnionTypeDefinition':
                handleDirectives('visitUnion');
                break;
            case 'EnumTypeDefinition':
                handleDirectives('visitEnum');
                extension.values.forEach(value => walk(value, schema.getValue(nameOf(value))));
                break;
            case 'EnumValueDefinition':
                handleDirectives('visitEnumValue');
                break;
            case 'DirectiveDefinition':
                // Do nothing
                break;
            default:
                throw new Error(`Unexpected node "${extension.kind}"`);
        }

        function handleDirectives(visitor) {
            if (Array.isArray(extension.directives) && extension.directives.length) {
                const directives = extension.directives.map(createDirective);
                if (Array.isArray(schema.directives)) {
                    schema.directives.push(...directives);
                } else {
                    schema.directives = directives;
                }
                directives.forEach(processDirective);
            }

            function processDirective(directive) {
                if (typeof directive[visitor] === 'function') {
                    directive[visitor](schema);
                }
            }
        }
    }

    function createDirective(definition) {
        const directiveName = nameOf(definition);
        if (typeof directives[directiveName] !== 'function') {
            throw new Error(`No directive named "${directiveName}" found!`);
        }

        const args = definition.arguments.reduce(reduceArg, {});
        const instance = new directives[directiveName]({
            args,
            schema,
            context,
            name: directiveName
        });
        return instance;

        function reduceArg(result, arg) {
            if (arg.kind !== 'Argument') {
                throw new Error(`Invalid argument block "${arg.kind}" received. expected "Argument"`);
            }
            const name = nameOf(arg);
            const value = valueOf(arg);

            result[name] = value;
            return result;
        }
    }

    function nameOf(node) {
        const name = node && node.name && node.name.kind === 'Name' && node.name.value;
        if (!name) {
            throw new Error('Unable to determine name');
        }
        return name;
    }

    function valueOf(node) {
        switch (node.value.kind) {
            case 'IntValue':
                return parseInt(node.value.value);
            case 'FloatValue':
                return parseFloat(node.value.value);
            case 'StringValue':
            case 'BooleanValue':
            default:
                return node.value.value;
        }
    }
}
