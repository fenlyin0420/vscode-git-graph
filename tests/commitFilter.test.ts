import { getCommitFilterArguments, parseCommitFilter } from '../src/commitFilter';

describe('commitFilter', () => {
	describe('parseCommitFilter', () => {
		it('Should return an empty filter when the query is empty', () => {
			// Run
			const filter = parseCommitFilter('');

			// Assert
			expect(filter).toStrictEqual({ keywords: [], authors: [], since: null, until: null });
		});

		it('Should return an empty filter when the query only contains whitespace', () => {
			// Run
			const filter = parseCommitFilter('   ');

			// Assert
			expect(filter).toStrictEqual({ keywords: [], authors: [], since: null, until: null });
		});

		it('Should parse keywords, authors and dates', () => {
			// Run
			const filter = parseCommitFilter('fix @author:jane@example.com @date:2021-01-01..2021-12-31 bug');

			// Assert
			expect(filter).toStrictEqual({
				keywords: ['fix', 'bug'],
				authors: ['jane@example.com'],
				since: '2021-01-01',
				until: '2021-12-31'
			});
		});

		it('Should parse a date without a range as a lower bound', () => {
			// Run
			const filter = parseCommitFilter('@date:2021-01-01');

			// Assert
			expect(filter).toStrictEqual({ keywords: [], authors: [], since: '2021-01-01', until: null });
		});

		it('Should parse a date range with either side omitted', () => {
			// Run
			const lowerBoundOnly = parseCommitFilter('@date:2021-01-01..'), upperBoundOnly = parseCommitFilter('@date:..2021-12-31');

			// Assert
			expect(lowerBoundOnly).toStrictEqual({ keywords: [], authors: [], since: '2021-01-01', until: null });
			expect(upperBoundOnly).toStrictEqual({ keywords: [], authors: [], since: null, until: '2021-12-31' });
		});

		it('Should support double quoted values containing whitespace', () => {
			// Run
			const filter = parseCommitFilter('@author:"Jane Doe" "context menu"');

			// Assert
			expect(filter).toStrictEqual({
				keywords: ['context menu'],
				authors: ['Jane Doe'],
				since: null,
				until: null
			});
		});

		it('Should parse the prefixes case insensitively', () => {
			// Run
			const filter = parseCommitFilter('@AUTHOR:Jane @Date:2021-01-01');

			// Assert
			expect(filter).toStrictEqual({ keywords: [], authors: ['Jane'], since: '2021-01-01', until: null });
		});

		it('Should ignore empty author and date values', () => {
			// Run
			const filter = parseCommitFilter('@author: @date:');

			// Assert
			expect(filter).toStrictEqual({ keywords: [], authors: [], since: null, until: null });
		});

		it('Should treat unknown prefixes as keywords', () => {
			// Run
			const filter = parseCommitFilter('@unknown:value');

			// Assert
			expect(filter).toStrictEqual({ keywords: ['@unknown:value'], authors: [], since: null, until: null });
		});

		it('Should ignore a date range where both sides are omitted', () => {
			// Run
			const filter = parseCommitFilter('@date:..');

			// Assert
			expect(filter).toStrictEqual({ keywords: [], authors: [], since: null, until: null });
		});

		it('Should keep an unterminated quoted value as a single token', () => {
			// Run
			const filter = parseCommitFilter('@author:"Jane Doe fix');

			// Assert
			expect(filter).toStrictEqual({ keywords: [], authors: ['Jane Doe fix'], since: null, until: null });
		});
	});

	describe('getCommitFilterArguments', () => {
		it('Should return no arguments for an empty filter', () => {
			// Run
			const args = getCommitFilterArguments(parseCommitFilter(''));

			// Assert
			expect(args).toStrictEqual([]);
		});

		it('Should match all keywords using extended (case insensitive) regular expressions', () => {
			// Run
			const args = getCommitFilterArguments(parseCommitFilter('fix bug'));

			// Assert
			expect(args).toStrictEqual(['--extended-regexp', '--regexp-ignore-case', '--grep=fix', '--grep=bug', '--all-match']);
		});

		it('Should match a single keyword without --all-match', () => {
			// Run
			const args = getCommitFilterArguments(parseCommitFilter('fix'));

			// Assert
			expect(args).toStrictEqual(['--extended-regexp', '--regexp-ignore-case', '--grep=fix']);
		});

		it('Should match the author of the commit', () => {
			// Run
			const args = getCommitFilterArguments(parseCommitFilter('@author:"Jane Doe"'));

			// Assert
			expect(args).toStrictEqual(['--extended-regexp', '--regexp-ignore-case', '--author=Jane Doe']);
		});

		it('Should make a date only bound inclusive of the whole day', () => {
			// Run
			const args = getCommitFilterArguments(parseCommitFilter('@date:2021-01-01..2021-12-31'));

			// Assert
			expect(args).toStrictEqual(['--since=2021-01-01 00:00:00', '--until=2021-12-31 23:59:59']);
		});

		it('Should make a lower bound only filter start at the beginning of the day', () => {
			// Run
			const args = getCommitFilterArguments(parseCommitFilter('@date:2021-01-01'));

			// Assert
			expect(args).toStrictEqual(['--since=2021-01-01 00:00:00']);
		});

		it('Should not modify bounds that contain a time', () => {
			// Run
			const args = getCommitFilterArguments(parseCommitFilter('@date:"2021-01-01 08:30".."2021-12-31 12:00:00"'));

			// Assert
			expect(args).toStrictEqual(['--since=2021-01-01 08:30', '--until=2021-12-31 12:00:00']);
		});

		it('Should match any of multiple authors (--all-match only applies to the keywords)', () => {
			// Run
			const args = getCommitFilterArguments(parseCommitFilter('@author:jane @author:john'));

			// Assert
			expect(args).toStrictEqual(['--extended-regexp', '--regexp-ignore-case', '--author=jane', '--author=john']);
		});

		it('Should keep the whitespace of a quoted keyword in a single argument', () => {
			// Run
			const args = getCommitFilterArguments(parseCommitFilter('"context menu"'));

			// Assert
			expect(args).toStrictEqual(['--extended-regexp', '--regexp-ignore-case', '--grep=context menu']);
		});
	});
});
