const isClickable = entity => ['A', 'BUTTON', 'IMG', 'P-RADIOBUTTON', 'P-CHECKBOX'].includes(entity.tagName) || (entity.tagName === 'INPUT' && ['button', 'reset', 'image', 'submit'].includes(entity.type));

const isInteractive = entity => ['INPUT', 'A', 'BUTTON', 'IMG', 'SELECT', 'TEXTAREA', 'P-RADIOBUTTON', 'P-CHECKBOX', 'p-DROPDOWN'].includes(entity.tagName);

export { isClickable, isInteractive };
