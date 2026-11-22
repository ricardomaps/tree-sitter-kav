; lines inside these nodes are indented one level more than the line
; the node starts on
[
  (block)
  (case_arm)
  (guard_arm)
  (case_expression)
  (guard_expression)
  (if_expression)
  (val_binding)
  (datatype_declaration)
  (struct_declaration)
  (constructor)
  (parameters)
  (sort_parameters)
  (function_type)
  (call_expression)
  (sort_application)
  (constructor_pattern)
  (tuple_expression)
  (tuple_pattern)
  (tuple_type)
  (parenthesized_expression)
  (parenthesized_pattern)
  (parenthesized_type)
] @indent

; closing brackets go back out
[
  ; "}"
  ")"
  "]"
] @outdent
