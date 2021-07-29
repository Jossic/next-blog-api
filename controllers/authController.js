const User = require('../models/userModel');
const shortId = require('shortid');
const jwt = require('jsonwebtoken');
const expressJwt = require('express-jwt');
const _ = require('lodash');
const { errorHandler } = require('../helpers/dbErrorHandler');
const Blog = require('../models/blogModel');
const { OAuth2Client } = require('google-auth-library');

const { sendEmailWithNodemailer } = require('../helpers/email');

exports.preSignup = (req, res) => {
	const { name, email, password } = req.body;
	User.findOne({ email: email.toLowerCase() }, (err, user) => {
		if (user) {
			return res.status(400).json({
				error: 'Email déjà pris',
			});
		}
		const token = jwt.sign(
			{ name, email, password },
			process.env.JWT_SECRET_ACTIVATION,
			{
				expiresIn: '15m',
			}
		);

		const emailData = {
			from: process.env.NODE_MAILER_NOREPLY,
			to: email,
			subject: `${process.env.APP_NAME} | Lien d'activation de votre compte`,
			html: `
        <h4>Afin d'activer votre compte</h4>
        <p>Merci de suivre le lien suivant: ${process.env.CLIENT_URL}/auth/account/activate/${token}</p>
        `,
		};

		sendEmailWithNodemailer(req, res, emailData);
		res.json({
			message: `Mail envoyé à l'adresse ${email}. Merci de suivre les instructions sans les 15 minutes`,
		});
	});
};

// exports.signup = (req, res) => {
// 	User.findOne({
// 		email: req.body.email,
// 	}).exec((err, user) => {
// 		if (user) {
// 			return res.status(400).json({
// 				error: 'Cet email est déjà utilisé',
// 			});
// 		}

// 		const { name, email, password } = req.body;
// 		let username = shortId.generate();
// 		let profile = `${process.env.CLIENT_URL}/profile/${username}`;

// 		let newUser = new User({
// 			name,
// 			email,
// 			password,
// 			profile,
// 			username,
// 		});
// 		newUser.save((err, success) => {
// 			if (err) {
// 				return res.status(400).json({
// 					error: err,
// 				});
// 			}
// 			// res.json({
// 			// 	user: success,
// 			// });
// 			res.json({
// 				message: 'Enregistrement confirmé, connectez-vous',
// 			});
// 		});
// 	});
// };

exports.signup = (req, res) => {
	const token = req.body.token;
	if (token) {
		jwt.verify(token, process.env.JWT_SECRET_ACTIVATION, (err, decoded) => {
			if (err) {
				return res.status(401).json({
					error: 'Lien expiré, Recommencez',
				});
			}
			const { name, email, password } = jwt.decode(token);
			let username = shortId.generate();
			let profile = `${process.env.CLIENT_URL}/profile/${username}`;

			const user = new User({ name, email, password, profile, username });
			user.save((err, user) => {
				if (err) {
					return res.status(401).json({
						error: errorHandler(err),
					});
				}
				return res.json({
					message: 'Enregistrement validé, connectez-vous !',
				});
			});
		});
	} else {
		return res.json({
			message: 'Ouups, quelque chose ne va pas, rééssayez !',
		});
	}
};

exports.signin = (req, res) => {
	const { email, password } = req.body;

	User.findOne({ email }).exec((err, user) => {
		if (err || !user) {
			return res.status(400).json({
				error: 'Cet email est déjà utilisé, vous pouvez vous connecter',
			});
		}

		if (!user.authenticate(password)) {
			return res.status(400).json({
				error: 'Identifiant et/ou mot de passe incorrecte',
			});
		}

		const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, {
			expiresIn: '1w',
		});

		res.cookie('token', token, {
			expiresIn: '1w',
		});
		const { _id, username, name, email, role } = user;
		return res.json({
			token,
			user: {
				_id,
				username,
				name,
				email,
				role,
			},
		});
	});
};

exports.signout = (req, res) => {
	res.clearCookie('token');
	res.json({
		message: 'Vous êtes maintenant deconnecté.',
	});
};

exports.requireSignin = expressJwt({
	secret: process.env.JWT_SECRET,
	algorithms: ['HS256'],
	// userProperty: 'auth',
});

exports.authMiddleware = (req, res, next) => {
	const authUserId = req.user._id;
	User.findById({ _id: authUserId }).exec((err, user) => {
		if (err || !user) {
			return res.status(400).json({
				error: 'Utilisateur non trouvé',
			});
		}
		req.profile = user;
		next();
	});
};

exports.adminMiddleware = (req, res, next) => {
	console.log(req.user);
	const adminUserId = req.user._id;
	User.findById({ _id: adminUserId }).exec((err, user) => {
		if (err || !user) {
			return res.status(400).json({
				error: 'Utilisateur non trouvé',
			});
		}

		if (user.role !== 1) {
			return res.status(400).json({
				error: 'Espace réservé à un administrateur',
			});
		}

		req.profile = user;
		next();
	});
};

exports.canUpdateDeleteBlog = (req, res, next) => {
	const slug = req.params.slug.toLowerCase();
	Blog.findOne({ slug }).exec((err, data) => {
		if (err) {
			return res.status(400).json({
				error: errorHandler(err),
			});
		}
		let authorizedUser =
			data.postedBy._id.toString() === req.profile._id.toString();
		if (!authorizedUser) {
			return res.status(400).json({
				error: 'Non autorisé',
			});
		}
		next();
	});
};

exports.forgotPassword = (req, res) => {
	const { email } = req.body;

	User.findOne({ email }, (err, user) => {
		if (err || !user) {
			return res.status(401).json({
				error: 'Aucun utilisateur avec cet adresse mail',
			});
		}
		const token = jwt.sign(
			{ _id: user._id },
			process.env.JWT_RESET_PASSWORD,
			{ expiresIn: '15m' }
		);

		const emailData = {
			from: process.env.NODE_MAILER_NOREPLY,
			to: email,
			subject: `${process.env.APP_NAME} | Lien de réinitialisation de mot de passe`,
			html: `
        <h4>Réinitialisation du mot de passe, merci de ne pas tenir compte de ce mail si vous n'êtes pas à l'origine de cette procèdure:</h4>
        <p>Merci de suivre le lien suivant: ${process.env.CLIENT_URL}/auth/password/reset/${token}</p>
        `,
		};

		return user.updateOne({ resetPasswordLink: token }, (err, success) => {
			if (err) {
				return res.json({ error: errorHandler(err) });
			} else {
				sendEmailWithNodemailer(req, res, emailData);
				res.json({
					message: `Mail envoyé à l'adresse ${email}. Merci de suivre les instructions sous 15 minutes`,
				});
			}
		});
	});
};

exports.resetPassword = (req, res) => {
	const { resetPasswordLink, newPassword } = req.body;
	if (resetPasswordLink) {
		jwt.verify(
			resetPasswordLink,
			process.env.JWT_RESET_PASSWORD,
			function (err, decoded) {
				if (err) {
					return res.status(401).json({
						error: `Lien expiré, merci d'essayer à nouveau`,
					});
				}
				User.findOne({ resetPasswordLink }, (err, user) => {
					if (err || !user) {
						return res.status(401).json({
							error: `Ouups, il y a un problème, merci d'essayer à nouveau`,
						});
					}
					const updatedFields = {
						password: newPassword,
						resetPasswordLink: '',
					};

					user = _.extend(user, updatedFields);

					user.save((err, result) => {
						if (err) {
							return res.status(400).json({
								error: errorHandler(err),
							});
						}
						res.json({
							message: `C'est bon ! Vous pouvez maintenant vous connecter`,
						});
					});
				});
			}
		);
	}
};

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
exports.googleLogin = (req, res) => {
	const idToken = req.body.tokenId;
	client
		.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID })
		.then((response) => {
			const { email_verified, name, email, jti } = response.payload;
			if (email_verified) {
				User.findOne({ email }).exec((err, user) => {
					if (user) {
						const token = jwt.sign(
							{ _id: user._id },
							process.env.JWT_SECRET,
							{ expiresIn: '1w' }
						);
						res.cookie('token', token, { expiresIn: '1w' });
						const { _id, email, name, role, username } = user;
						return res.json({
							token,
							user: { _id, email, name, role, username },
						});
					} else {
						let username = shortId.generate();
						let profile = `${process.env.CLIENT_URL}/profile/${username}`;
						let password = jti + process.env.JWT_SECRET;
						user = new User({
							name,
							email,
							profile,
							username,
							password,
						});
						user.save((err, data) => {
							if (err) {
								return res.status(400).json({
									error: errorHandler(err),
								});
							}
							const token = jwt.sign(
								{ _id: data._id },
								process.env.JWT_SECRET,
								{ expiresIn: '1w' }
							);
							res.cookie('token', token, { expiresIn: '1w' });
							const { _id, email, name, role, username } = data;
							return res.json({
								token,
								user: { _id, email, name, role, username },
							});
						});
					}
				});
			} else {
				return res.status(400).json({
					error: 'Echec de la connexion, essayer à nouveau',
				});
			}
		});
};
