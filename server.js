const express = require('express');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const blogRoutes = require('./routes/blogRoutes');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const tagRoutes = require('./routes/tagRoutes');
const formRoutes = require('./routes/formRoutes');

const app = express();

mongoose
	.connect(process.env.DATABASE_CLOUD, {
		useUnifiedTopology: true,
		useNewUrlParser: true,
		useCreateIndex: true,
		useFindAndModify: false,
	})
	.then(() => {
		console.log('Database Connected');
	});

app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(
	cors({
		origin: `${process.env.CLIENT_URL}`,
	})
);

app.use('/api', blogRoutes);
app.use('/api', authRoutes);
app.use('/api', userRoutes);
app.use('/api', categoryRoutes);
app.use('/api', tagRoutes);
app.use('/api', formRoutes);

const port = process.env.PORT || 8000;
app.listen(port, () => {
	console.log(`Server is running on port ${port}`);
});
