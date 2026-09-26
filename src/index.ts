'use strict';
/**
 * [EN]    Diploma Digital (MEC) use case — 3 isolated signer endpoints, KMS custody.
 *         Dev:  npm run dev
 *         Step 1: POST http://localhost:8095/api/diploma/step1-representante
 *         Step 2: POST http://localhost:8095/api/diploma/step2-emissora-dados
 *         Step 3: POST http://localhost:8095/api/diploma/step3-envelope-final
 * [PT-BR] Caso de uso Diploma Digital (MEC) — 3 endpoints isolados por assinante, custódia KMS.
 */
import 'dotenv/config';
import express, { Request, Response } from 'express';
import multer from 'multer';
import { DiplomaSigningService } from './service';

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const service = new DiplomaSigningService();

async function handleStep(
  req: Request, res: Response,
  signFn: (document: Express.Multer.File, kmsCode: string) => Promise<Buffer | null>,
  outputName: string,
) {
  const document = req.file;
  const kmsCode = (req.body as Record<string, string>).kmsCode;
  if (!document || !kmsCode) return res.status(400).json({ error: 'document and kmsCode are required' });

  const signed = await signFn(document, kmsCode);
  if (!signed) return res.status(500).json({ error: 'Signing failed. Check logs.' });

  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Content-Disposition', `attachment; filename="${outputName}"`);
  return res.send(signed);
}

app.post('/api/diploma/step1-representante', upload.single('document'), (req, res) =>
  handleStep(req, res, service.signStep1Representante.bind(service), 'diploma_step1_signed.xml'));

app.post('/api/diploma/step2-emissora-dados', upload.single('document'), (req, res) =>
  handleStep(req, res, service.signStep2EmissoraDados.bind(service), 'diploma_step2_signed.xml'));

app.post('/api/diploma/step3-envelope-final', upload.single('document'), (req, res) =>
  handleStep(req, res, service.signStep3EnvelopeFinal.bind(service), 'diploma_step3_signed.xml'));

const PORT = Number(process.env.PORT ?? 8095);
app.listen(PORT, () => console.info(`SolidSign Diploma use-case example (TS) running on port ${PORT}`));
