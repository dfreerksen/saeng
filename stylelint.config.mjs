/** @type {import("stylelint").Config} */
export default {
  extends: [
    "stylelint-config-standard",
    "stylelint-config-standard-scss"
  ],
  "plugins": [
    "stylelint-order"
  ],
  'order/properties-order': [
    {
      name: 'positioning',
      properties: ['position', 'bottom', 'left', 'right', 'top']
    }
  ],
  "rules": {
    "at-rule-no-unknown": [true, {
      "ignoreAtRules": ["if", "else", "for", "extend", "include", "mixin", "use"]
    }],
    "declaration-no-important": true,
    "order/order": [
      "dollar-variables",
      "at-rules",
      {
        "type": "at-rule",
        "name": "extend"
      },
      {
        "type": "at-rule",
        "name": "include"
      },
      {
        "type": "at-rule",
        "name": "media"
      },
      "declarations",
      "rules"
    ],
    "order/properties-alphabetical-order": true
  },
  "ignoreFiles": [
    "src/renderer/styles.css",
  ]
};
