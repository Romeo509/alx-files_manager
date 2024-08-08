import sha1 from 'sha1';
import { ObjectId } from 'mongodb';
import dbClient from '../utils/db.js';
import redisClient from '../utils/redis.js';

class UsersController {
  static async postNew(req, res) {
    const { email, password } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }

    if (!password) {
      return res.status(400).json({ error: 'Missing password' });
    }

    const hashedPassword = sha1(password);

    try {
      const usersCollection = dbClient.db.collection('users');
      const existingUser = await usersCollection.findOne({ email });

      if (existingUser) {
        return res.status(400).json({ error: 'Already exist' });
      }

      const result = await usersCollection.insertOne({ email, password: hashedPassword });
      const newUser = await usersCollection.findOne(
        { _id: result.insertedId },
        { projection: { email: 1 } },
      );

      return res.status(201).json({ id: newUser._id, email: newUser.email });
    } catch (err) {
      console.error('Error creating new user:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  static async getMe(req, res) {
    try {
      const token = req.header('X-Token');
      const authKey = `auth_${token}`;

      const userId = await redisClient.get(authKey);

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const user = await dbClient.getUser({ _id: ObjectId(userId) });

      return res.json({ id: user._id, email: user.email });
    } catch (err) {
      console.error('Error fetching user data:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }
}

export default UsersController;
