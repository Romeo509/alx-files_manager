import Queue from 'bull';
import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import { mkdir, writeFile, readFileSync } from 'fs';
import mime from 'mime-types';
import dbClient from '../utils/db.js';
import { getIdAndKey, isValidUser } from '../utils/users';

class FilesController {
  static async postUpload(req, res) {
    const fileQueue = new Queue('fileQueue');
    const directory = process.env.FOLDER_PATH || '/tmp/files_manager';

    const { userId } = await getIdAndKey(req);
    if (!isValidUser(userId)) return res.status(401).json({ error: 'Unauthorized' });

    const user = await dbClient.users.findOne({ _id: ObjectId(userId) });
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const {
      name: fileName, type: fileType, data: fileData, isPublic = false, parentId = 0,
    } = req.body;
    if (!fileName) return res.status(400).json({ error: 'Missing name' });
    if (!fileType || !['folder', 'file', 'image'].includes(fileType)) return res.status(400).json({ error: 'Invalid type' });
    if (!fileData && fileType !== 'folder') return res.status(400).json({ error: 'Missing data' });

    const parentFolderId = parentId === '0' ? 0 : parentId;
    if (parentFolderId !== 0) {
      const parentFile = await dbClient.files.findOne({ _id: ObjectId(parentFolderId) });
      if (!parentFile || parentFile.type !== 'folder') return res.status(400).json({ error: 'Invalid parent folder' });
    }

    const fileInsert = {
      userId: user._id,
      name: fileName,
      type: fileType,
      isPublic,
      parentId: parentFolderId,
    };

    if (fileType === 'folder') {
      const result = await dbClient.files.insertOne(fileInsert);
      return res.status(201).json({
        id: result.insertedId,
        ...fileInsert,
      });
    }

    const fileUuid = uuidv4();
    const decodedData = Buffer.from(fileData, 'base64');
    const filePath = `${directory}/${fileUuid}`;

    mkdir(directory, { recursive: true }, (err) => {
      if (err) return res.status(400).json({ error: err.message });
    });

    writeFile(filePath, decodedData, (err) => {
      if (err) return res.status(400).json({ error: err.message });
    });

    fileInsert.localPath = filePath;
    const result = await dbClient.files.insertOne(fileInsert);

    fileQueue.add({
      userId: fileInsert.userId,
      fileId: result.insertedId,
    });

    return res.status(201).json({
      id: result.insertedId,
      ...fileInsert,
    });
  }

  static async getShow(req, res) {
    const { userId } = await getIdAndKey(req);
    if (!isValidUser(userId)) return res.status(401).json({ error: 'Unauthorized' });

    const user = await dbClient.users.findOne({ _id: ObjectId(userId) });
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const fileId = req.params.id;
    const file = await dbClient.files.findOne({ _id: ObjectId(fileId), userId: user._id });
    if (!file) return res.status(404).json({ error: 'Not found' });

    return res.status(200).json({
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
    });
  }

  static async getIndex(req, res) {
    const { userId } = await getIdAndKey(req);
    if (!isValidUser(userId)) return res.status(401).json({ error: 'Unauthorized' });

    const user = await dbClient.users.findOne({ _id: ObjectId(userId) });
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    let parentId = req.query.parentId || 0;
    parentId = parentId === '0' ? 0 : ObjectId(parentId);

    if (parentId !== 0) {
      const parentFile = await dbClient.files.findOne({ _id: parentId, type: 'folder' });
      if (!parentFile) return res.status(200).json([]);
    }

    const page = parseInt(req.query.page, 10) || 0;
    const files = await dbClient.files.find({ parentId }).skip(page * 20).limit(20).toArray();

    return res.status(200).json(files.map((file) => ({
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
    })));
  }

  static async putPublish(req, res) {
    const { userId } = await getIdAndKey(req);
    if (!isValidUser(userId)) return res.status(401).json({ error: 'Unauthorized' });

    const user = await dbClient.users.findOne({ _id: ObjectId(userId) });
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const fileId = req.params.id;
    const file = await dbClient.files.findOne({ _id: ObjectId(fileId), userId: user._id });
    if (!file) return res.status(404).json({ error: 'Not found' });

    await dbClient.files.updateOne({ _id: ObjectId(fileId) }, { $set: { isPublic: true } });

    return res.status(200).json({
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: true,
      parentId: file.parentId,
    });
  }

  static async putUnpublish(req, res) {
    const { userId } = await getIdAndKey(req);
    if (!isValidUser(userId)) return res.status(401).json({ error: 'Unauthorized' });

    const user = await dbClient.users.findOne({ _id: ObjectId(userId) });
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const fileId = req.params.id;
    const file = await dbClient.files.findOne({ _id: ObjectId(fileId), userId: user._id });
    if (!file) return res.status(404).json({ error: 'Not found' });

    await dbClient.files.updateOne({ _id: ObjectId(fileId) }, { $set: { isPublic: false } });

    return res.status(200).json({
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: false,
      parentId: file.parentId,
    });
  }

  static async getFile(req, res) {
    const fileId = req.params.id;
    const size = req.query.size || 0;

    const file = await dbClient.files.findOne({ _id: ObjectId(fileId) });
    if (!file) return res.status(404).json({ error: 'Not found' });

    const { isPublic, userId, type } = file;
    const { userId: user } = await getIdAndKey(req);

    if ((!isPublic && !user) || (user && userId.toString() !== user && !isPublic)) return res.status(404).json({ error: 'Not found' });
    if (type === 'folder') return res.status(400).json({ error: 'A folder doesn\'t have content' });

    const filePath = size === 0 ? file.localPath : `${file.localPath}_${size}`;

    try {
      const fileData = readFileSync(filePath);
      const mimeType = mime.contentType(file.name);
      res.setHeader('Content-Type', mimeType);
      return res.status(200).send(fileData);
    } catch (err) {
      return res.status(404).json({ error: 'Not found' });
    }
  }
}

export default FilesController;
