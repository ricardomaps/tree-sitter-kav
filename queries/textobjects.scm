; functions: the whole declaration, and the body block
(function_declaration
  body: (block) @function.inside) @function.around

; "classes": things that define a type. `inside` is the list of members.
(datatype_declaration
  "{"
  (_)* @class.inside
  "}") @class.around

(struct_declaration
  "{"
  (_)* @class.inside
  "}") @class.around

(newtype_declaration) @class.around
(typedef_declaration) @class.around
(sortdef_declaration) @class.around

; parameters: `around` also takes the trailing comma
(parameters
  ((parameter) @parameter.inside . ","? @parameter.around) @parameter.around)

(sort_parameters
  ((sort_parameter) @parameter.inside . ","? @parameter.around) @parameter.around)

(struct_declaration
  ((parameter) @parameter.inside . ","? @parameter.around) @parameter.around)

; call and sort-application arguments
(call_expression
  "("
  ((_) @parameter.inside . ","? @parameter.around) @parameter.around
  ")")

(sort_application
  "["
  ((_) @parameter.inside . ","? @parameter.around) @parameter.around
  "]")

; arms and constructors
(case_arm
  body: (_) @entry.inside) @entry.around

(guard_arm
  body: (_) @entry.inside) @entry.around

(constructor) @entry.around
(constructor) @entry.inside

; comments
(line_comment) @comment.inside
(line_comment) @comment.around

(block_comment) @comment.inside
(block_comment) @comment.around

(doc_comment) @comment.inside
(doc_comment) @comment.around
