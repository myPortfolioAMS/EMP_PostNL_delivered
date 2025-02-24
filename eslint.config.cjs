const js = require("@eslint/js");
const tseslint = require("@typescript-eslint/eslint-plugin");
const tsparser = require("@typescript-eslint/parser");
const prettier = require("eslint-plugin-prettier");

module.exports = [
    js.configs.recommended,
    {
        ignores: ["node_modules/", "dist/", "cdk.out/"],
    },
    {
        files: ["**/*.js", "**/*.ts", "**/*.tsx"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            parser: tsparser,
            globals: {
                console: "readonly",
                test: "readonly",
                expect: "readonly",
                describe: "readonly",
                require: "readonly",
                module: "readonly",
                process: "readonly",
            },
        },
        plugins: {
            "@typescript-eslint": tseslint,
            prettier: prettier,
        },
        rules: {
            "prettier/prettier": ["error", { trailingComma: "all" }],
            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/no-unused-vars": [
                "error",
                { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
            ],
            "no-console": "warn",
        },
    },
];
