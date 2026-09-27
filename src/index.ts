'use strict';
/**
 * [EN]    Diploma Digital (MEC) use case — all 5 documents, KMS custody.
 *         Dev: npm run dev
 * [PT-BR] Caso de uso Diploma Digital (MEC) — os 5 documentos, custódia KMS.
 */
import 'dotenv/config';
import express, { Request, Response } from 'express';
import multer from 'multer';
import { sign, StepConfig } from './xmlKmsSigningService';
import { assemble } from './diplomaAssemblyService';

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

function stepFromEnv(prefix: string): StepConfig {
  return {
    nodeName: process.env[`${prefix}_NODE_NAME`],
    namespace: process.env[`${prefix}_NAMESPACE`],
    profile: process.env[`${prefix}_PROFILE`] ?? '',
    removeXPathFilter: process.env[`${prefix}_REMOVE_XPATH_FILTER`] === 'true',
  };
}

async function handleStep(req: Request, res: Response, step: StepConfig, outputName: string) {
  const document = req.file;
  const kmsCode = (req.body as Record<string, string>).kmsCode;
  if (!document || !kmsCode) return res.status(400).json({ error: 'document and kmsCode are required' });

  const signed = await sign(document, kmsCode, step);
  if (!signed) return res.status(500).json({ error: 'Signing failed. Check logs.' });

  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Content-Disposition', `attachment; filename="${outputName}"`);
  return res.send(signed);
}

// ─── Documento 1/5 — Documentação Acadêmica de Registro ────────────────────
app.post('/api/diploma/documentacao-academica/step1-representante', upload.single('document'), (req, res) =>
  handleStep(req, res, stepFromEnv('SOLIDSIGN_DOCACAD_STEP1'), 'documentacao_academica_step1_signed.xml'));
app.post('/api/diploma/documentacao-academica/step2-emissora-dados', upload.single('document'), (req, res) =>
  handleStep(req, res, stepFromEnv('SOLIDSIGN_DOCACAD_STEP2'), 'documentacao_academica_step2_signed.xml'));
app.post('/api/diploma/documentacao-academica/step3-envelope-final', upload.single('document'), (req, res) =>
  handleStep(req, res, stepFromEnv('SOLIDSIGN_DOCACAD_STEP3'), 'documentacao_academica_step3_signed.xml'));

// ─── Documento 2/5 — Diploma Digital (montagem + 2 etapas) ─────────────────
app.post('/api/diploma/diploma/assemble', upload.single('signedDocumentacaoAcademica'), (req, res) => {
  const document = req.file;
  if (!document) return res.status(400).json({ error: 'signedDocumentacaoAcademica is required' });
  const assembled = assemble(document.buffer.toString('utf-8'));
  if (!assembled) return res.status(400).json({ error: 'Assembly failed. Check logs.' });
  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Content-Disposition', 'attachment; filename="diploma_montado.xml"');
  return res.send(assembled);
});
app.post('/api/diploma/diploma/step1-registradora-dados', upload.single('document'), (req, res) =>
  handleStep(req, res, stepFromEnv('SOLIDSIGN_DIPLOMA_STEP1'), 'diploma_step1_signed.xml'));
app.post('/api/diploma/diploma/step2-envelope-final', upload.single('document'), (req, res) =>
  handleStep(req, res, stepFromEnv('SOLIDSIGN_DIPLOMA_STEP2'), 'diploma_step2_signed.xml'));

// ─── Documento 3/5 — Histórico Escolar Digital ─────────────────────────────
app.post('/api/diploma/historico-escolar/step1-secretaria-dados', upload.single('document'), (req, res) =>
  handleStep(req, res, stepFromEnv('SOLIDSIGN_HISTESC_STEP1'), 'historico_escolar_step1_signed.xml'));
app.post('/api/diploma/historico-escolar/step2-envelope-final', upload.single('document'), (req, res) =>
  handleStep(req, res, stepFromEnv('SOLIDSIGN_HISTESC_STEP2'), 'historico_escolar_step2_signed.xml'));

// ─── Documento 4/5 — Currículo Escolar Digital (documento inteiro) ─────────
app.post('/api/diploma/curriculo-escolar/step1-coordenador', upload.single('document'), (req, res) =>
  handleStep(req, res, stepFromEnv('SOLIDSIGN_CURRESC_STEP1'), 'curriculo_escolar_step1_signed.xml'));
app.post('/api/diploma/curriculo-escolar/step2-envelope-final', upload.single('document'), (req, res) =>
  handleStep(req, res, stepFromEnv('SOLIDSIGN_CURRESC_STEP2'), 'curriculo_escolar_step2_signed.xml'));

// ─── Documento 5/5 — Lista de Diplomas Anulados / Arquivo de Fiscalização ──
app.post('/api/diploma/lista-anulados/sign', upload.single('document'), (req, res) =>
  handleStep(req, res, stepFromEnv('SOLIDSIGN_LISTAANUL'), 'lista_anulados_signed.xml'));

const PORT = Number(process.env.PORT ?? 8095);
app.listen(PORT, () => console.info(`SolidSign Diploma use-case example (TS) running on port ${PORT}`));
