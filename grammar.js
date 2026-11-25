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

  externals: ($) => [$._call_lparen, $._call_lbrack],

  extras: ($) => [/\s/, $.line_comment, $.block_comment, $.doc_comment],

  rules: {
    source_file: ($) => repeat($._declaration),

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
        optional('extern'),
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
        optional('abstract'),
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
        optional('abstract'),
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

    sort_parameters: ($) => seq('[', commaSep1($.sort_parameter), ']'),

    sort_parameter: ($) =>
      seq(
        field('name', $.identifier),
        ':',
        field('type', $._type),
        optional(seq('|', field('condition', $._expression))),
      ),

    parameters: ($) => seq('(', commaSep($.parameter), ')'),

    parameter: ($) =>
      seq(field('name', $.identifier), ':', field('type', $._type)),

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

    existential_type: ($) =>
      seq($.sort_parameters, field('body', $._type)),

    borrow_type: ($) => seq('!', field('body', $._type)),

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

    _expression: ($) =>
      choice(
        $.if_expression,
        $.guard_expression,
        $.case_expression,
        $._binary,
        $.anonymous_function,
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

    guard_expression: ($) =>
      seq('guard', '{', repeat1($.guard_arm), '}'),

    guard_arm: ($) =>
      seq(
        '|',
        field('condition', $._expression),
        '=>',
        field('body', $._expression),
      ),

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
          [PREC.additive, choice('+', '-', '|>')],
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

    call_expression: ($) =>
      seq(
        field('function', $._name),
        alias($._call_lparen, '('),
        commaSep($._expression),
        ')',
      ),

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

    block: ($) =>
      seq('{', repeat($.val_binding), field('result', $._expression), '}'),

    anonymous_function: ($) => 
      seq(
        'fn',
        optional(field('sort_parameters', $.sort_parameters)),
        field('parameters', $.parameters),
        '->',
        field('return_type', $._type),
        field('body', $.block),
      ),

    val_binding: ($) =>
      seq(
        'val',
        field('pattern', $._pattern),
        optional(seq(':', field('type', $._type))),
        '=',
        field('value', $._expression),
      ),

    _pattern: ($) => choice($.consuming_pattern, $._base_pattern),

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

    _name: ($) => choice($.identifier, $.scoped_identifier),

    scoped_identifier: ($) =>
      seq(field('namespace', $.identifier), '::', field('name', $.identifier)),

    identifier: (_) => /[a-zA-Z_][a-zA-Z_0-9]*/,

    wildcard: (_) => '_',

    number: (_) => /[0-9]+/,

    string: (_) =>
      token(seq('"', repeat(choice(/[^"\\\n]/, /\\[^\n]/)), '"')),

    system_path: (_) => /<[^>\n]*>/,

    line_comment: (_) => token(seq('//', /[^\n]*/)),

    block_comment: (_) =>
      token(seq('/*', repeat(choice(/[^*]/, /\*+[^*\/]/)), /\*+\//)),

    doc_comment: (_) =>
      token(seq('/%', repeat(choice(/[^%]/, /%+[^%\/]/)), /%+\//)),
  },
});
