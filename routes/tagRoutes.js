const express = require('express');
const router = express.Router();
const { create, list, read, remove } = require('../controllers/tagController');
const {
	adminMiddleware,
	requireSignin,
} = require('../controllers/authController');

const { runValidation } = require('../validators');
const { createTagValidator } = require('../validators/tag');

router.post(
	'/tag',
	createTagValidator,
	runValidation,
	requireSignin,
	adminMiddleware,
	create
);
router.get('/tags', list);
router.get('/tag/:slug', read);
router.delete('/tag/:slug', requireSignin, adminMiddleware, remove);

module.exports = router;
