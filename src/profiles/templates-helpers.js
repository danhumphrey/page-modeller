const isClickable = entity => ['A', 'BUTTON', 'IMG'].includes(entity.tagName) || (entity.tagName === 'INPUT' && ['button', 'reset', 'image', 'submit'].includes(entity.type));

const isInteractive = entity => ['INPUT', 'A', 'BUTTON', 'IMG', 'SELECT', 'TEXTAREA'].includes(entity.tagName);

export { isClickable, isInteractive };
