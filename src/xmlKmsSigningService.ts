'use strict';
/**
 * [EN]    Generic single-document XAdES signing call via a SolidSign KMS-custodied certificate
 *         (POST /solidsign/dsig/xml/sign-kms). Shared by every document/step of the Diploma
 *         Digital use case; when nodeName is falsy, the whole document is signed.
 * [PT-BR] Chamada genérica de assinatura XAdES via certificado custodiado no KMS da SolidSign.
 *         Compartilhada por todos os documentos/etapas; quando nodeName é vazio, o documento
 *         inteiro é assinado.
 */
import axios from 'axios';
import FormData from 'form-data';

interface SignLink { rel: string; href: string; }
interface SignedDocument { hash?: string; links?: SignLink[]; _links?: { self?: { href: string } }; }
interface SignResponse { identifier?: string; signatureCount?: number; documents: SignedDocument[]; }

export interface StepConfig {
  nodeName?: string;
  namespace?: string;
  profile: string;
  removeXPathFilter: boolean;
}

export async function sign(
  document: Express.Multer.File, kmsCode: string, step: StepConfig,
): Promise<Buffer | null> {
  const baseUrl = (process.env.SOLIDSIGN_API_BASE_URL ?? '').replace(/\/$/, '');
  const authorization = process.env.SOLIDSIGN_API_AUTHORIZATION ?? '';
  const hashAlgorithm = process.env.SOLIDSIGN_DIPLOMA_HASH_ALGORITHM ?? 'SHA256';
  const signaturePackaging = process.env.SOLIDSIGN_DIPLOMA_SIGNATURE_PACKAGING ?? 'ENVELOPED';
  const canonicalizationMethod = process.env.SOLIDSIGN_DIPLOMA_CANONICALIZATION_METHOD ?? 'EXCLUSIVE';

  const form = new FormData();
  form.append('document[0]', document.buffer, { filename: document.originalname });
  form.append('kmsCode', kmsCode);
  form.append('profile', step.profile);
  form.append('hashAlgorithm', hashAlgorithm);
  form.append('signaturePackaging', signaturePackaging);
  form.append('canonicalizationMethod', canonicalizationMethod);
  if (step.nodeName) {
    form.append('signatureNodeName[0]', step.nodeName);
    form.append('signatureNodeNamespace[0]', step.namespace ?? '');
  }
  form.append('isRemoveXPathExclusionFilter', String(step.removeXPathFilter));

  try {
    const resp = await axios.post<SignResponse>(`${baseUrl}/solidsign/dsig/xml/sign-kms`, form,
      { headers: { Authorization: authorization, ...form.getHeaders() }, timeout: 120000 });
    const doc = resp.data.documents?.[0];
    const href = doc?._links?.self?.href ?? doc?.links?.find((l) => l.rel === 'self')?.href;
    if (!href) { console.error('SolidSign response had no download link.'); return null; }

    const dl = await axios.get<ArrayBuffer>(href, {
      headers: { Authorization: authorization }, responseType: 'arraybuffer', timeout: 120000,
    });
    return Buffer.from(dl.data);
  } catch (err) {
    if (axios.isAxiosError(err)) {
      console.error(`SolidSign API error ${err.response?.status}: ${JSON.stringify(err.response?.data)}`);
    } else {
      console.error(`Unexpected error during signing: ${(err as Error).message}`);
    }
    return null;
  }
}
