/**
 * A filter that is applied to the commits shown in the Git Graph View.
 */
export interface CommitFilter {
	/** Keywords that must all be found in the commit message. */
	readonly keywords: ReadonlyArray<string>;
	/** Patterns that must match the author name or email of the commit. */
	readonly authors: ReadonlyArray<string>;
	/** The date (or date/time) from which commits are shown, or NULL (no lower bound). */
	readonly since: string | null;
	/** The date (or date/time) until which commits are shown, or NULL (no upper bound). */
	readonly until: string | null;
}

const AUTHOR_PREFIX = '@author:';
const DATE_PREFIX = '@date:';
const DATE_ONLY_REGEXP = /^\d{4}-\d{2}-\d{2}$/;
const WHITESPACE_REGEXP = /\s/;

/**
 * Parse a Commit Filter query into a `CommitFilter`.
 *
 * The query is a whitespace separated list of tokens, where a token is either:
 *  - `<keyword>`: the commit message must contain this keyword
 *  - `@author:<pattern>`: the author name or email must match this pattern
 *  - `@date:<date>`: only show commits made on or after this date
 *  - `@date:<date>..<date>`: only show commits made in this date range (either side can be omitted)
 *
 * Values containing whitespace can be quoted (e.g. `@author:"Jane Doe"`).
 * @param query The Commit Filter query entered by the user.
 * @returns The parsed Commit Filter.
 */
export function parseCommitFilter(query: string): CommitFilter {
	const tokens = tokenize(query);
	let keywords: string[] = [], authors: string[] = [], since: string | null = null, until: string | null = null;
	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i], lowerCaseToken = token.toLowerCase();
		if (lowerCaseToken.startsWith(AUTHOR_PREFIX)) {
			const author = token.substring(AUTHOR_PREFIX.length).trim();
			if (author !== '') authors.push(author);
		} else if (lowerCaseToken.startsWith(DATE_PREFIX)) {
			const value = token.substring(DATE_PREFIX.length).trim(), rangeIndex = value.indexOf('..');
			if (rangeIndex > -1) {
				const from = value.substring(0, rangeIndex).trim(), to = value.substring(rangeIndex + 2).trim();
				if (from !== '') since = from;
				if (to !== '') until = to;
			} else if (value !== '') {
				since = value;
			}
		} else {
			keywords.push(token);
		}
	}
	return { keywords: keywords, authors: authors, since: since, until: until };
}

/**
 * Get the `git log` arguments that apply the specified Commit Filter.
 * @param filter The Commit Filter to apply.
 * @returns The `git log` arguments.
 */
export function getCommitFilterArguments(filter: CommitFilter): string[] {
	let args: string[] = [];
	if (filter.keywords.length > 0 || filter.authors.length > 0) {
		// The keywords and author patterns are Extended Regular Expressions, matched case insensitively
		args.push('--extended-regexp', '--regexp-ignore-case');
	}
	for (let i = 0; i < filter.keywords.length; i++) {
		args.push('--grep=' + filter.keywords[i]);
	}
	if (filter.keywords.length > 1) {
		// All of the keywords must be found in the commit message
		args.push('--all-match');
	}
	for (let i = 0; i < filter.authors.length; i++) {
		args.push('--author=' + filter.authors[i]);
	}
	if (filter.since !== null) {
		args.push('--since=' + formatDateBound(filter.since, false));
	}
	if (filter.until !== null) {
		args.push('--until=' + formatDateBound(filter.until, true));
	}
	return args;
}

/**
 * Format a date bound so that a date without a time covers the whole day (Git would otherwise use the current time).
 * @param value The date (or date/time) entered by the user.
 * @param isUpper Is this the upper bound of the filter.
 * @returns The formatted date bound.
 */
function formatDateBound(value: string, isUpper: boolean): string {
	return DATE_ONLY_REGEXP.test(value) ? value + (isUpper ? ' 23:59:59' : ' 00:00:00') : value;
}

/**
 * Split a Commit Filter query into tokens, where whitespace within double quotes is kept as part of the token.
 * @param query The Commit Filter query entered by the user.
 * @returns The tokens of the query.
 */
function tokenize(query: string): string[] {
	let tokens: string[] = [], token = '', inQuotes = false;
	for (let i = 0; i < query.length; i++) {
		const char = query.charAt(i);
		if (char === '"') {
			inQuotes = !inQuotes;
		} else if (!inQuotes && WHITESPACE_REGEXP.test(char)) {
			if (token !== '') {
				tokens.push(token);
				token = '';
			}
		} else {
			token += char;
		}
	}
	if (token !== '') tokens.push(token);
	return tokens;
}
