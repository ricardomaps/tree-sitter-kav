/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const PREC = {
  compare: 1,
  additive: 2,
  multiplicative: 3,
  unary: 4,
};

/** @param {RuleOrLiteral} rule */
const commaSep1 = (rule) => seq(rule, repeat(seq(',', rule)));
/** @param {RuleOrLiteral} rule */
const commaSep = (rule) => optional(commaSep1(rule));

module.exports = grammar({
  name: 'kav',

  word: ($) => $.identifier,

  // Tokens produced by src/scanner.c. The language only treats `(` and `[`
  // as the start of a call / sort application when they are on the same line
  // as the name before them, which a context-free grammar can't express.
  externals: ($) => [$._call_lparen, $._call_lbrack],

  extras: ($) => [/\s/, $.line_comment, $.block_comment, $.doc_comment],

  rules: {
    source_file: ($) => repeat($._declaration),

    // ---------------------------------------------------------------
    // declarations
    // ---------------------------------------------------------------

    _declaration: ($) =>
      choice(
        $.function_declaration,
        $.struct_declaration,
        $.datatype_declaration,
        $.newtype_declaration,
        $.typedef_declaration,
        $.sortdef_declaration,
        $.use_declaration,
      ),

    function_declaration: ($) =>
      seq(
        optional('pub'),
        'fn',
        field('name', $.identifier),
        optional(field('sort_parameters', $.sort_parameters)),
        field('parameters', $.parameters),
        '->',
        field('return_type', $._type),
        field('body', $.block),
      ),

    struct_declaration: ($) =>
      seq(
        optional('pub'),
        optional('linear'),
        'struct',
        field('name', $._type_name_def),
        '{',
        commaSep($.parameter),
        '}',
      ),

    datatype_declaration: ($) =>
      seq(
        optional('pub'),
        optional('linear'),
        'datatype',
        field('name', $._type_name_def),
        optional(field('sort_parameters', $.sort_parameters)),
        '{',
        repeat($.constructor),
        '}',
      ),

    constructor: ($) =>
      seq(
        '|',
        optional(field('sort_parameters', $.sort_parameters)),
        field('name', $.identifier),
        optional(seq('(', commaSep1($._type), ')')),
        optional(seq(':', field('result', $._type))),
      ),

    newtype_declaration: ($) =>
      seq(
        optional('pub'),
        optional('linear'),
        'newtype',
        field('name', $._type_name_def),
        '=',
        field('definition', $._type),
      ),

    typedef_declaration: ($) =>
      seq(
        optional('pub'),
        'typedef',
        field('name', $._type_name_def),
        optional(field('sort_parameters', $.sort_parameters)),
        '=',
        field('definition', $._type),
      ),

    // `sortdef nat = [n: int | n >= 0]`. When the definition starts with `[`
    // it is always a sort parameter list, never an existential type.
    sortdef_declaration: ($) =>
      seq(
        optional('pub'),
        'sortdef',
        field('name', $._type_name_def),
        '=',
        choice(
          field('sort_parameters', $.sort_parameters),
          field('definition', $._simple_type),
        ),
      ),

    use_declaration: ($) =>
      seq(
        optional('pub'),
        'use',
        field('path', choice($.string, $.system_path)),
        optional(seq('as', field('alias', $.identifier))),
      ),

    _type_name_def: ($) => alias($.identifier, $.type_identifier),

    // [a: type, n: nat | n > 0]
    sort_parameters: ($) => seq('[', commaSep1($.sort_parameter), ']'),

    sort_parameter: ($) =>
      seq(
        field('name', $.identifier),
        ':',
        field('type', $._type),
        optional(seq('|', field('condition', $._expression))),
      ),

    // (x: int, y: !List[int, n])
    parameters: ($) => seq('(', commaSep($.parameter), ')'),

    parameter: ($) =>
      seq(field('name', $.identifier), ':', field('type', $._type)),

    // ---------------------------------------------------------------
    // types
    // ---------------------------------------------------------------

    _type: ($) => choice($.existential_type, $._simple_type),

    _simple_type: ($) =>
      choice(
        $.borrow_type,
        $.function_type,
        $.tuple_type,
        $.parenthesized_type,
        $.sort_application,
        $._type_name,
      ),

    _type_name: ($) =>
      choice(
        alias($.identifier, $.type_identifier),
        alias($.scoped_identifier, $.scoped_type_identifier),
      ),

    // [m: nat] List[a, m]
    existential_type: ($) =>
      seq($.sort_parameters, field('body', $._type)),

    // !List[a, n]
    borrow_type: ($) => seq('!', field('body', $._type)),

    // fn(int, !List[int, n]) -> int
    function_type: ($) =>
      seq(
        'fn',
        '(',
        commaSep($._type),
        ')',
        '->',
        field('return_type', $._type),
      ),

    tuple_type: ($) => seq('(', $._type, ',', commaSep1($._type), ')'),

    parenthesized_type: ($) => seq('(', $._type, ')'),

    // ---------------------------------------------------------------
    // expressions
    // ---------------------------------------------------------------

    _expression: ($) =>
      choice(
        $.if_expression,
        $.guard_expression,
        $.case_expression,
        $._binary,
      ),

    _binary: ($) => choice($.binary_expression, $._unary),

    _unary: ($) => choice($.unary_expression, $._call),

    _call: ($) => choice($.call_expression, $.sort_application, $._primary),

    _primary: ($) =>
      choice(
        $.number,
        $.string,
        $.wildcard,
        $._name,
        $.block,
        $.parenthesized_expression,
        $.tuple_expression,
      ),

    if_expression: ($) =>
      seq(
        'if',
        field('condition', $._expression),
        'then',
        field('consequence', $._expression),
        'else',
        field('alternative', $._expression),
      ),

    // guard { | cond => expr | _ => expr }
    guard_expression: ($) =>
      seq('guard', '{', repeat1($.guard_arm), '}'),

    guard_arm: ($) =>
      seq(
        '|',
        field('condition', $._expression),
        '=>',
        field('body', $._expression),
      ),

    // case x of { | pat => expr }
    case_expression: ($) =>
      seq(
        'case',
        field('scrutinee', $._expression),
        'of',
        '{',
        repeat1($.case_arm),
        '}',
      ),

    case_arm: ($) =>
      seq(
        '|',
        field('pattern', $._pattern),
        '=>',
        field('body', $._expression),
      ),

    binary_expression: ($) =>
      choice(
        ...[
          [PREC.compare, choice('==', '!=', '<', '>', '<=', '>=')],
          [PREC.additive, choice('+', '-')],
          [PREC.multiplicative, choice('*', '/', '%')],
        ].map(([precedence, operator]) =>
          prec.left(
            // @ts-ignore
            precedence,
            seq(
              field('left', $._binary),
              // @ts-ignore
              field('operator', operator),
              field('right', $._binary),
            ),
          ),
        ),
      ),

    unary_expression: ($) =>
      prec(PREC.unary, seq(field('operator', '-'), field('operand', $._unary))),

    // f(x, 1)
    call_expression: ($) =>
      seq(
        field('function', $._name),
        alias($._call_lparen, '('),
        commaSep($._expression),
        ')',
      ),

    // List[a, n + 1]
    sort_application: ($) =>
      seq(
        field('name', $._type_name),
        alias($._call_lbrack, '['),
        commaSep($._expression),
        ']',
      ),

    parenthesized_expression: ($) => seq('(', $._expression, ')'),

    tuple_expression: ($) =>
      seq('(', $._expression, ',', commaSep1($._expression), ')'),

    // { val x = 1  val y: int = 2  x + y }
    block: ($) =>
      seq('{', repeat($.val_binding), field('result', $._expression), '}'),

    val_binding: ($) =>
      seq(
        'val',
        field('pattern', $._pattern),
        optional(seq(':', field('type', $._type))),
        '=',
        field('value', $._expression),
      ),

    // ---------------------------------------------------------------
    // patterns
    // ---------------------------------------------------------------

    _pattern: ($) => choice($.consuming_pattern, $._base_pattern),

    // ~Cons(x, xs): matching consumes the linear value
    consuming_pattern: ($) => seq('~', $._base_pattern),

    _base_pattern: ($) =>
      choice(
        $.wildcard,
        $.number,
        $.tuple_pattern,
        $.parenthesized_pattern,
        $.constructor_pattern,
        $._name,
      ),

    constructor_pattern: ($) =>
      seq(
        field('constructor', $._name),
        '(',
        commaSep1($._pattern),
        ')',
      ),

    tuple_pattern: ($) =>
      seq('(', $._pattern, ',', commaSep1($._pattern), ')'),

    parenthesized_pattern: ($) => seq('(', $._pattern, ')'),

    // ---------------------------------------------------------------
    // names and tokens
    // ---------------------------------------------------------------

    _name: ($) => choice($.identifier, $.scoped_identifier),

    // maybe::None
    scoped_identifier: ($) =>
      seq(field('namespace', $.identifier), '::', field('name', $.identifier)),

    identifier: (_) => /[a-zA-Z_][a-zA-Z_0-9]*/,

    // `_` is a hole in expressions and a wildcard in patterns
    wildcard: (_) => '_',

    number: (_) => /[0-9]+/,

    string: (_) =>
      token(seq('"', repeat(choice(/[^"\\\n]/, /\\[^\n]/)), '"')),

    // only lexed directly after `use`: use <std/list>
    system_path: (_) => /<[^>\n]*>/,

    line_comment: (_) => token(seq('//', /[^\n]*/)),

    block_comment: (_) =>
      token(seq('/*', repeat(choice(/[^*]/, /\*+[^*\/]/)), /\*+\//)),

    // /% doc comment %/
    doc_comment: (_) =>
      token(seq('/%', repeat(choice(/[^%]/, /%+[^%\/]/)), /%+\//)),
  },
});
