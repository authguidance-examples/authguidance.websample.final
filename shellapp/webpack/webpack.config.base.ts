import path from 'path';
import webpack from 'webpack';

const dirname = process.cwd();
const config: webpack.Configuration = {

    // Set the working folder and build bundles for the browser
    context: path.resolve(dirname, './src'),
    target: ['web'],
    devtool: false,

    entry: {

        // Specify the application entry point
        app: ['./index.ts']
    },
    module: {
        rules: [{

            // Files with a .ts extension are loaded by the Typescript loader
            test: /\.ts$/,
            use: 'ts-loader',
            exclude: /node_modules/
        }]
    },
    resolve: {

        // Set extensions for import statements
        extensions: ['.ts', '.js']
    },
    output: {

        // Output our Javascript bundles to a dist folder
        path: path.resolve(dirname, '../dist/shellapp'),
        filename: '[name].bundle.js'
    }
};

export default config;
