;;; kav-ts-mode.el --- Tree-sitter major mode for the kav language -*- lexical-binding: t; -*-

;; Major mode for editing kav source files
;;
;; Install the grammar with:
;;
;;     M-x treesit-install-language-grammar RET kav RET
;;
;; (needs a C compiler and git).  Then open any .kav file.

(require 'treesit)
(require 'rx)

(declare-function treesit-parser-create "treesit.c")
(declare-function treesit-node-type "treesit.c")
(declare-function treesit-node-text "treesit.c")
(declare-function treesit-node-child-by-field-name "treesit.c")

(defgroup kav-ts-mode nil
  "Major mode for editing kav code, using tree-sitter."
  :group 'languages
  :prefix "kav-ts-mode-")

(defcustom kav-ts-mode-indent-offset 4
  "Number of spaces for each indentation step in `kav-ts-mode'."
  :type 'integer
  :safe #'integerp
  :group 'kav-ts-mode)

(add-to-list 'treesit-language-source-alist
             '(kav "https://github.com/ricardomaps/tree-sitter-kav"))

(defvar kav-ts-mode--syntax-table
  (let ((table (make-syntax-table)))
    (modify-syntax-entry ?/  ". 124b" table)
    (modify-syntax-entry ?*  ". 23"   table)
    (modify-syntax-entry ?\n "> b"    table)
    (modify-syntax-entry ?\" "\""     table)
    (modify-syntax-entry ?\\ "\\"     table)
    (modify-syntax-entry ?_  "_"      table)
    (modify-syntax-entry ?+  "."      table)
    (modify-syntax-entry ?-  "."      table)
    (modify-syntax-entry ?%  "."      table)
    (modify-syntax-entry ?=  "."      table)
    (modify-syntax-entry ?<  "."      table)
    (modify-syntax-entry ?>  "."      table)
    (modify-syntax-entry ?!  "."      table)
    (modify-syntax-entry ?|  "."      table)
    (modify-syntax-entry ?~  "."      table)
    table)
  "Syntax table for `kav-ts-mode'.")

(defconst kav-ts-mode--builtin-types
  (rx bos (or "type" "utype" "int" "bool" "one") eos)
  "Regexp matching the built-in type and sort names.")

(defconst kav-ts-mode--capitalized
  (rx bos (any "A-Z"))
  "Regexp matching capitalized names (constructors and user defined types).")

(defvar kav-ts-mode--font-lock-settings
  (treesit-font-lock-rules
   :language 'kav
   :feature 'comment
   '((line_comment) @font-lock-comment-face
     (block_comment) @font-lock-comment-face)

   :language 'kav
   :feature 'comment
   '((doc_comment) @font-lock-doc-face)

   :language 'kav
   :feature 'definition
   '((function_declaration
      name: (identifier) @font-lock-function-name-face)
     (constructor
      name: (identifier) @font-lock-constant-face)
     (parameter
      name: (identifier) @font-lock-variable-name-face)
     (sort_parameter
      name: (identifier) @font-lock-variable-name-face)
     (use_declaration
      alias: (identifier) @font-lock-type-face))

   :language 'kav
   :feature 'keyword
   '(["fn" "struct" "datatype" "newtype" "typedef" "sortdef" "pub" "linear" "if" "then"
      "else" "case" "of" "guard" "val" "use" "as"]
     @font-lock-keyword-face)

   :language 'kav
   :feature 'string
   '((string) @font-lock-string-face
     (system_path) @font-lock-string-face)

   :language 'kav
   :feature 'number
   '((number) @font-lock-number-face)

   :language 'kav
   :feature 'constant
   '(((identifier) @font-lock-constant-face
      (:match "\\`\\(?:true\\|false\\)\\'" @font-lock-constant-face))
     (wildcard) @font-lock-builtin-face)

   :language 'kav
   :feature 'type
   `(((type_identifier) @font-lock-builtin-face
      (:match ,kav-ts-mode--builtin-types @font-lock-builtin-face))
     (type_identifier) @font-lock-type-face
     (scoped_type_identifier
      namespace: (identifier) @font-lock-type-face
      name: (identifier) @font-lock-type-face))

   :language 'kav
   :feature 'constructor
   `((constructor_pattern
      constructor: (identifier) @font-lock-constant-face)
     (constructor_pattern
      constructor: (scoped_identifier
                    name: (identifier) @font-lock-constant-face))
     ((call_expression
       function: (identifier) @font-lock-constant-face)
      (:match ,kav-ts-mode--capitalized @font-lock-constant-face))
     ((call_expression
       function: (scoped_identifier
                  name: (identifier) @font-lock-constant-face))
      (:match ,kav-ts-mode--capitalized @font-lock-constant-face))
     ((case_arm
       pattern: (identifier) @font-lock-constant-face)
      (:match ,kav-ts-mode--capitalized @font-lock-constant-face))
     ((consuming_pattern
       (identifier) @font-lock-constant-face)
      (:match ,kav-ts-mode--capitalized @font-lock-constant-face))
     ((scoped_identifier
       name: (identifier) @font-lock-constant-face)
      (:match ,kav-ts-mode--capitalized @font-lock-constant-face)))

   :language 'kav
   :feature 'function
   '((call_expression
      function: (identifier) @font-lock-function-call-face)
     (call_expression
      function: (scoped_identifier
                 name: (identifier) @font-lock-function-call-face)))

   :language 'kav
   :feature 'namespace
   '((scoped_identifier
      namespace: (identifier) @font-lock-type-face))

   :language 'kav
   :feature 'operator
   '(["+" "-" "*" "/" "%"
      "==" "!=" "<" ">" "<=" ">="
      "=" "=>" "->" "|" "~" "!"]
     @font-lock-operator-face)

   :language 'kav
   :feature 'bracket
   '(["(" ")" "[" "]" "{" "}"] @font-lock-bracket-face)

   :language 'kav
   :feature 'delimiter
   '(["," ":" "::"] @font-lock-delimiter-face)

   :language 'kav
   :feature 'error
   :override t
   '((ERROR) @font-lock-warning-face))
  "Tree-sitter font-lock settings for `kav-ts-mode'.")

(defvar kav-ts-mode--indent-rules
  (let ((offset 'kav-ts-mode-indent-offset))
    `((kav
       ((parent-is "source_file") column-0 0)

       ((node-is "}") parent-bol 0)
       ((node-is ")") parent-bol 0)
       ((node-is "]") parent-bol 0)

       ((parent-is "block") parent-bol ,offset)
       ((parent-is "case_expression") parent-bol ,offset)
       ((parent-is "guard_expression") parent-bol ,offset)
       ((parent-is "datatype_declaration") parent-bol ,offset)
       ((parent-is "struct_declaration") parent-bol ,offset)
       ((parent-is "parameters") parent-bol ,offset)
       ((parent-is "sort_parameters") parent-bol ,offset)
       ((parent-is "call_expression") parent-bol ,offset)
       ((parent-is "sort_application") parent-bol ,offset)
       ((parent-is "function_type") parent-bol ,offset)
       ((parent-is "constructor_pattern") parent-bol ,offset)
       ((parent-is "tuple_expression") parent-bol ,offset)
       ((parent-is "tuple_pattern") parent-bol ,offset)
       ((parent-is "tuple_type") parent-bol ,offset)
       ((parent-is "parenthesized_expression") parent-bol ,offset)
       ((parent-is "parenthesized_pattern") parent-bol ,offset)
       ((parent-is "parenthesized_type") parent-bol ,offset)

       ((parent-is "case_arm") parent-bol ,offset)
       ((parent-is "guard_arm") parent-bol ,offset)
       ((parent-is "if_expression") parent-bol ,offset)
       ((parent-is "val_binding") parent-bol ,offset)
       ((parent-is "constructor") parent-bol ,offset)
       ((parent-is "binary_expression") parent-bol ,offset)
       ((parent-is "function_declaration") parent-bol ,offset)
       ((parent-is "newtype_declaration") parent-bol ,offset)
       ((parent-is "typedef_declaration") parent-bol ,offset)
       ((parent-is "sortdef_declaration") parent-bol ,offset)

       (catch-all parent-bol 0))))
  "Tree-sitter indentation rules for `kav-ts-mode'.")

(defun kav-ts-mode--defun-name (node)
  (pcase (treesit-node-type node)
    ((or "function_declaration" "struct_declaration" "datatype_declaration"
         "newtype_declaration" "typedef_declaration" "sortdef_declaration")
     (when-let* ((name (treesit-node-child-by-field-name node "name")))
       (treesit-node-text name t)))))

(defconst kav-ts-mode--defun-regexp
  (rx bos (or "function_declaration" "struct_declaration"
              "datatype_declaration" "newtype_declaration"
              "typedef_declaration" "sortdef_declaration")
      eos)
  "Regexp matching node types that count as a \"defun\".")

(define-derived-mode kav-ts-mode prog-mode "Kav"
  "Major mode for editing kav code, powered by tree-sitter.

\\{kav-ts-mode-map}"
  :group 'kav-ts-mode
  :syntax-table kav-ts-mode--syntax-table

  (if (not (treesit-ready-p 'kav))
      (message "kav tree-sitter grammar not available; \
run M-x treesit-install-language-grammar RET kav")
    (treesit-parser-create 'kav)

    (setq-local comment-start "// ")
    (setq-local comment-end "")
    (setq-local comment-start-skip "\\(?://+\\|/\\*+\\)\\s *")

    (setq-local indent-tabs-mode nil)
    (setq-local treesit-simple-indent-rules kav-ts-mode--indent-rules)

    (setq-local treesit-defun-type-regexp kav-ts-mode--defun-regexp)
    (setq-local treesit-defun-name-function #'kav-ts-mode--defun-name)

    (setq-local treesit-simple-imenu-settings
                `(("Function" "\\`function_declaration\\'"
                   nil kav-ts-mode--defun-name)
                  ("Type"
                   ,(rx bos (or "struct_declaration" "datatype_declaration"
                                "newtype_declaration" "typedef_declaration"
                                "sortdef_declaration")
                        eos)
                   nil kav-ts-mode--defun-name)))

    (setq-local treesit-font-lock-settings kav-ts-mode--font-lock-settings)
    (setq-local treesit-font-lock-feature-list
                '((comment definition)
                  (keyword string number type)
                  (constant constructor function namespace operator)
                  (bracket delimiter error)))

    (treesit-major-mode-setup)))

(add-to-list 'auto-mode-alist '("\\.kav\\'" . kav-ts-mode))

(provide 'kav-ts-mode)
