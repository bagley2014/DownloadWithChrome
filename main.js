import * as cheerio from 'cheerio';

import { chainPromises, downloadFile, got, ResultCounts, sideEffect, splitArray } from './helpers.js';

import { getCookiesPromised } from 'chrome-cookies-secure';
import path from 'path';

// This file contains the main body of the app and the functions it uses

const setupCookies = url => () => chainPromises(null, [
	() => getCookiesPromised(url.origin, 'jar'),
	cookieJar => got.defaults.options.cookieJar = cookieJar,
]);

const getLinksFromUrl = (url, options) => () => chainPromises(null, [
	() => got(url, { resolveBodyOnly: true, responseType: 'text' })
		.catch(err => {
			console.error(`${url} | ${err.message}`);
			return Promise.reject(err);
		}),
	cheerio.load,
	$ => Promise.allSettled(
		$('td a')
			.toArray()
			.map(element => $(element).attr('href'))
			.filter(href => href.match('^[^\\\\/]'))
			.map(href => {
				if (options.recursive && href.match('[\\\\/]$')) {
					const childDir = new URL(url);
					childDir.pathname += `/${href}`;
					return getLinksFromUrl(childDir, options)();
				} else if (!options.filter || href.match(options.filter)) {
					const fileToDownload = new URL(url);
					fileToDownload.pathname += `/${href}`;
					return fileToDownload;
				}
				return Promise.reject(`${href} | Didn't match filter`);
			}),
	),
	links => links
		.filter(link => link.status == 'fulfilled')
		.map(link => link.value)
		.flat(),
]);

const addOutputLocations = outputDir => urls => urls.map(
	url => ({
		out: path.join(process.cwd(), outputDir, decodeURI(url.pathname)),
		url,
	}),
);

const logFilesToBeDownloaded = verbose => urls => {
	if (verbose) {
		console.log('Files to be downloaded:');
		console.log(
			urls.map(
				url => ({
					out: url.out,
					url: url.url.href,
				}),
			),
		);
	}
};

const rejectOnDryRun = dryrun => prevResult => dryrun ? Promise.reject({ name: 'dryrun_option_set' }) : Promise.resolve(prevResult);

const downloadFiles =
	verbose => urls => chainPromises(urls, [
		splitArray,
		sideEffect(
			urlLists => verbose ?
				console.log(`Download list lengths: ${urlLists.map(array => array.length)}`) :
				null,
		),
		sideEffect(() => console.log('Downloads started...')),
		urlLists => Promise.all(
			urlLists.map(
				urlList => chainPromises(new ResultCounts(), urlList.map(url => downloadFile(url, verbose))),
			),
		),
		results => results.reduce((cumulative, current) => cumulative.add(current)),
		sideEffect(() => console.log('All downloads finished')),
		console.log,
	]);

export const main = async (url, options, _command) => chainPromises(null, [
	sideEffect(() => options.debug ? console.log('Input url:', url) : null),
	sideEffect(() => options.debug ? console.log('Command line options:', options) : null),
	setupCookies(url),
	sideEffect(() => console.log('Determining files to download...')),
	getLinksFromUrl(url, options),
	addOutputLocations(options.output),
	sideEffect(logFilesToBeDownloaded(options.dryRun || options.debug)),
	rejectOnDryRun(options.dryRun),
	sideEffect(list => console.log(`Found ${list.length} files to download`)),
	downloadFiles(options.debug),
])
	.catch(
		reason => (
			reason.name == 'dryrun_option_set' ? console.log('Dry run complete; no files downloaded') :
			reason.name == 'HTTPError' ? console.log('There may be an error in your url, or perhaps the server is down; consider trying it in a browser') :
			console.log(`Script failed | Error: ${reason.message}`)
		),
	);

