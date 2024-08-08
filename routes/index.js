import express from 'express';
import AppController from '../controllers/AppController';
import UsersController from '../controllers/UsersController';
import AuthController from '../controllers/AuthController';
import FilesController from '../controllers/FilesController';

const router = express.Router();

const setupRoutes = (app) => {
  app.use('/', router);

  // App Routes
  router.route('/status').get(AppController.getStatus);

  router.route('/stats').get(AppController.getStats);

  // User Routes
  router.route('/users').post(UsersController.postNew);

  router.route('/users/me').get(UsersController.getMe);

  // Auth Routes
  router.route('/connect').get(AuthController.getConnect);

  router.route('/disconnect').get(AuthController.getDisconnect);

  // File Routes
  router.route('/files')
    .post(FilesController.postUpload)
    .get(FilesController.getIndex);

  router.route('/files/:id')
    .get(FilesController.getShow);

  router.route('/files/:id/publish')
    .put(FilesController.putPublish);

  router.route('/files/:id/unpublish')
    .put(FilesController.putUnpublish);

  router.route('/files/:id/data')
    .post(FilesController.getFile);
};

export default setupRoutes;
