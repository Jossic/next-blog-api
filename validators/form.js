const { check } = require('express-validator');

exports.contactFormValidator = [
	check('name').not().isEmpty().withMessage('Le nom est requis'),
	check('email').isEmail().withMessage('Le mail est requis'),
	check('message')
		.not()
		.isEmpty()
		.isLength({ min: 10 })
		.withMessage(
			'Le message doit obligatoirement faire plus de 10 caractères'
		),
];
