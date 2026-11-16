import express, { Request, Response } from 'express';
import { genericErrorHandler } from '@backend/_util/mongooseErrorHandler';
import mongoose from "mongoose"

interface CreateResourceRoutesOptions {
  populateFields?: string[]; // Array of populate paths; if provided, auto-populate on GET /:id, and conditionally on GET / if ?populate=true
  hasDelete?: boolean; // Whether to include DELETE /:id (default: true)
  useLean?: boolean; // Whether to use .lean() for queries (default: true, for perf)
  notFoundMessage: string; // lets enforce a proper message
}

export function createRoute(
  Model: mongoose.Model<any>, //safer
  options: CreateResourceRoutesOptions
) {
  const {
    notFoundMessage,
    populateFields = [],
    hasDelete = true,
    useLean = true,
  } = options;

  const router = express.Router();

  // GET / - Fetch all, optional populate if ?populate=true
  router.get('/', async (req: Request, res: Response) => {
    try {
      let query = Model.find();
      if (populateFields.length > 0 && req.query.populate) {
        populateFields.forEach((field) => query.populate(field));
      }
      const items = await query[useLean ? 'lean' : 'exec']();
      res.status(200).json(items);
    } catch (error) {
      genericErrorHandler(error, res);
    }
  });

  // GET /:id - Fetch one, always populate if fields provided
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      if (!id) {
        return res.status(400).send('ID is required');
      }
      let query = Model.findById(id);
      if (populateFields.length > 0) {
        populateFields.forEach((field) => query.populate(field));
      }
      const item = await query[useLean ? 'lean' : 'exec']();
      if (!item) {
        return res.status(404).send(notFoundMessage);
      }
      res.status(200).json(item);
    } catch (error) {
      genericErrorHandler(error, res);
    }
  });

  // POST / - Create, strip _id, handle validation errors
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { _id, ...rest } = req.body;
      await Model.create(rest);
      res.status(201).send();
    } catch (error: unknown) {
      genericErrorHandler(error, res);
    }
  });

  // PUT /:id - Replace entire doc (note: this is unsafe w/o validation; consider findByIdAndUpdate for safer partials)
  router.put('/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      if (!id) {
        return res.status(400).send('ID is required');
      }
      console.log(req.body);
      const result = await Model.findByIdAndUpdate(id, req.body);
      if (result.matchedCount === 0) {
        return res.status(404).send(notFoundMessage);
      }
      res.status(204).send();
    } catch (error) {
      genericErrorHandler(error, res);
    }
  });

  // DELETE /:id (optional)
  if (hasDelete) {
    router.delete('/:id', async (req: Request, res: Response) => {
      try {
        const id = req.params.id;
        if (!id) {
          return res.status(400).send('ID is required');
        }
        const deleted = await Model.findByIdAndDelete(id);
        if (!deleted) {
          return res.status(404).send(notFoundMessage);
        }
        res.status(204).send();
      } catch (error) {
        genericErrorHandler(error, res);
      }
    });
  }

  return router;
}