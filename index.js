#!/usr/bin/env node

import { main } from './main.js';
import { program } from 'commander';
import { URL } from 'url';

// if (process.stdout._handle) process.stdout._handle.setBlocking(true);

// This file serves as the entry point for the app
// It parses commandline options and calls main

const makeUrlObject = urlString => {
	try {
		return new URL(urlString);
	} catch (error) {
		console.error('There was an issue parsing your url - perhaps you forgot the protocol');
		process.exit(1);
	}
};

program
	.version('0.2.0', '-v, --version', 'output the current version')
	.description('Download files from a directory page using chrome cookies')
	.argument('<url>', 'url of directory page to download from', makeUrlObject)
	.option('--dry-run', 'quit the application before doing any downloads')
	.option('--filter <regex>', 'regex filter specifying which files to download')
	.option('-r, --recursive', 'indicates folder links on input url should be followed')
	.option('-o, --output <dir>', 'directory to place downloaded files', '.')
	.option('-d, --debug', 'indicates that the output should include information useful for debugging')
	.action(main);

program.parseAsync(process.argv);


