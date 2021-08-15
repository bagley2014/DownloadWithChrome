import * as cheerio from 'cheerio';

import { chainPromises, downloadFile, got, ResultCounts, sideEffect, splitArray } from './helpers.js';

import { getCookiesPromised } from 'chrome-cookies-secure';
import path from 'path';

// This file contains the main body of the app and the functions it uses

const getChromeCookies = url => () => getCookiesPromised(url.origin, 'jar');

const addCookiesToGot = cookieJar => got.defaults.options.cookieJar = cookieJar;

const getDirectoryHtml = url => () => got(url).text();

const getLinksFromDirectoyHtml =
	(url, options) => $ => $('td a')
		.toArray()
		.map(element => $(element).attr('href'))
		.filter(href => href.slice(-1).match('[^\\\\/]'))
		.filter(href => !options.filter || href.match(options.filter))
		.map(href => {
			const fileToDownload = new URL(url);
			fileToDownload.pathname += `/${href}`;
			return fileToDownload;
		});

const getOutputLocations = options => urls => urls.map(
	url => ({
		out: path.join(process.cwd(), options.output, decodeURI(url.pathname)),
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

const rejectOnDryRun = dryrun => prevResult => dryrun ? Promise.reject({ name: 'dryrun' }) : Promise.resolve(prevResult);

const downloadFileLists =
urlLists => Promise.all(
	urlLists.map(
		urlList => chainPromises([
			() => new ResultCounts(),
			...urlList.map(url => downloadFile(url)),
		]),
	),
)
	.then(results => results.reduce((cumulative, current) => cumulative.add(current)))
	.then(console.log);

export const main = async (url, options, _command) => chainPromises([
	sideEffect(() => options.debug ? console.log('Command line options:', options) : null),
	getChromeCookies(url),
	addCookiesToGot,
	getDirectoryHtml(url),
	cheerio.load,
	getLinksFromDirectoyHtml(url, options),
	getOutputLocations(options),
	sideEffect(logFilesToBeDownloaded(options.dryRun || options.debug)),
	rejectOnDryRun(options.dryRun),
	splitArray,
	sideEffect(
		arrays => options.debug
			? console.log(`Download list lengths: ${arrays.map(array => array.length)}`)
			: null,
	),
	downloadFileLists,
])
	.catch(
		reason => (
			reason.name == 'dryrun' ? console.log('Dry run complete; no files downloaded')
			: console.log(reason)
		),
	);

