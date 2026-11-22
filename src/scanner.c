#include "tree_sitter/parser.h"

/*
 * In kav a `(` or `[` directly after a name only starts a call or sort
 * application when it is on the same line as the name:
 *
 *     f(x)        // call
 *     f
 *     (x, y)      // not a call: a new expression
 *
 * These external tokens are only produced when the opening bracket is on the
 * same line, which is how the real parser (call() in parse.c) decides.
 */

enum TokenType {
	CALL_LPAREN,
	CALL_LBRACK,
};

void *tree_sitter_kav_external_scanner_create(void) { return NULL; }
void tree_sitter_kav_external_scanner_destroy(void *payload) { (void)payload; }

unsigned tree_sitter_kav_external_scanner_serialize(void *payload, char *buffer) {
	(void)payload;
	(void)buffer;
	return 0;
}

void tree_sitter_kav_external_scanner_deserialize(void *payload, const char *buffer, unsigned length) {
	(void)payload;
	(void)buffer;
	(void)length;
}

bool tree_sitter_kav_external_scanner_scan(void *payload, TSLexer *lexer, const bool *valid_symbols) {
	(void)payload;

	if(!valid_symbols[CALL_LPAREN] && !valid_symbols[CALL_LBRACK])
		return false;

	/* skip blanks, but never a newline */
	while(lexer->lookahead == ' ' || lexer->lookahead == '\t' || lexer->lookahead == '\r')
		lexer->advance(lexer, true);

	if(lexer->lookahead == '(' && valid_symbols[CALL_LPAREN]) {
		lexer->advance(lexer, false);
		lexer->mark_end(lexer);
		lexer->result_symbol = CALL_LPAREN;
		return true;
	}
	if(lexer->lookahead == '[' && valid_symbols[CALL_LBRACK]) {
		lexer->advance(lexer, false);
		lexer->mark_end(lexer);
		lexer->result_symbol = CALL_LBRACK;
		return true;
	}
	return false;
}
