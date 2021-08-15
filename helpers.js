import { createWriteStream } from 'fs';
import gotLib from 'got';
import { mkdir } from 'fs/promises';
import path from 'path';
import { pipeline } from 'stream/promises';

export const got = gotLib.extend({ mutableDefaults: true });

export const chainPromises = thens => thens.reduce(
	(chain, nextFunction) => chain.then(nextFunction),
	Promise.resolve(),
);

export const sideEffect = fn => r => {
	fn(r);
	return r;
};

export const splitArray = (a, n = 5) => {
	if (n < 2) return [a];

	const out = [];
	let size = 0;

	for (let i = 0; i < a.length; i += size) {
		size = Math.ceil((a.length - i) / n--);
		out.push(a.slice(i, i + size));
	}

	return out;
};

export class ResultCounts {
	constructor(successes = 0, fails = 0) {
		this.successCount = successes;
		this.failCount = fails;
	}

	addSuccess(n = 1) {
		this.successCount += n;
		return this;
	}

	addFail(n = 1) {
		this.failCount += n;
		return this;
	}

	add(result) {
		if (!(result instanceof ResultCounts)) throw new TypeError('Argument not instance of ResultCounts');

		this.failCount += result.failCount;
		this.successCount += result.successCount;
		return this;
	}
}

const doDownloadFile = urlObj => async results => {
	const { url, out } = urlObj;
	const fileName = path.basename(out);

	try {
		await mkdir(path.dirname(out), { recursive: true });
		await pipeline(
			got.stream(url),
			createWriteStream(out),
		);
		console.log(`Download successful | ${fileName} `);
		return results.addSuccess();
	} catch (error) {
		console.error(`Download failed | ${fileName} | ${error.message}`);
		return results.addFail();
	}
};

export const downloadFile = urlObj => doDownloadFile(urlObj);
