'use strict';
/**
 * [EN]    Signs the Diploma Digital XML at a specific stage of the MEC "Diploma Digital" flow
 *         using a SolidSign KMS-custodied certificate (POST /solidsign/dsig/xml/sign-kms).
 *         Each stage corresponds to a different real-world signer role and is exposed as an
 *         isolated endpoint in index.ts — this service does not chain the 3 stages together,
 *         since each one is normally executed by a different signer/system.
 * [PT-BR] Assina o XML do Diploma Digital em uma etapa específica do fluxo do MEC "Diploma
 *         Digital" usando um certificado custodiado no KMS da SolidSign. Cada etapa corresponde
 *         a um papel real de assinante distinto e é exposta como um endpoint isolado em
 *         index.ts — este service não encadeia as 3 etapas.
 */
import axios from 'axios';
import FormData from 'form-data';

interface SignLink { rel: string; href: string; }
interface SignedDocument { hash?: string; links?: SignLink[]; _links?: { self?: { href: string } }; }
interface SignResponse { identifier?: string; signatureCount?: number; documents: SignedDocument[]; }

interface StepConfig {
  nodeName: string;
  namespace: string;
  profile: string;
  removeXPathFilter: string;
}

export class DiplomaSigningService {
  private readonly baseUrl = (process.env.SOLIDSIGN_API_BASE_URL ?? '').replace(/\/$/, '');
  private readonly authorization = process.env.SOLIDSIGN_API_AUTHORIZATION ?? '';
  private readonly hashAlgorithm = process.env.SOLIDSIGN_DIPLOMA_HASH_ALGORITHM ?? 'SHA256';
  private readonly signaturePackaging = process.env.SOLIDSIGN_DIPLOMA_SIGNATURE_PACKAGING ?? 'ENVELOPED';
  private readonly canonicalizationMethod = process.env.SOLIDSIGN_DIPLOMA_CANONICALIZATION_METHOD ?? 'EXCLUSIVE';

  private readonly steps: Record<1 | 2 | 3, StepConfig> = {
    1: {
      nodeName: process.env.SOLIDSIGN_DIPLOMA_STEP1_NODE_NAME ?? '',
      namespace: process.env.SOLIDSIGN_DIPLOMA_STEP1_NAMESPACE ?? '',
      profile: process.env.SOLIDSIGN_DIPLOMA_STEP1_PROFILE ?? '',
      removeXPathFilter: process.env.SOLIDSIGN_DIPLOMA_STEP1_REMOVE_XPATH_FILTER ?? 'false',
    },
    2: {
      nodeName: process.env.SOLIDSIGN_DIPLOMA_STEP2_NODE_NAME ?? '',
      namespace: process.env.SOLIDSIGN_DIPLOMA_STEP2_NAMESPACE ?? '',
      profile: process.env.SOLIDSIGN_DIPLOMA_STEP2_PROFILE ?? '',
      removeXPathFilter: process.env.SOLIDSIGN_DIPLOMA_STEP2_REMOVE_XPATH_FILTER ?? 'false',
    },
    3: {
      nodeName: process.env.SOLIDSIGN_DIPLOMA_STEP3_NODE_NAME ?? '',
      namespace: process.env.SOLIDSIGN_DIPLOMA_STEP3_NAMESPACE ?? '',
      profile: process.env.SOLIDSIGN_DIPLOMA_STEP3_PROFILE ?? '',
      removeXPathFilter: process.env.SOLIDSIGN_DIPLOMA_STEP3_REMOVE_XPATH_FILTER ?? 'false',
    },
  };

  signStep1Representante(document: Express.Multer.File, kmsCode: string) { return this.sign(this.steps[1], document, kmsCode); }
  signStep2EmissoraDados(document: Express.Multer.File, kmsCode: string) { return this.sign(this.steps[2], document, kmsCode); }
  signStep3EnvelopeFinal(document: Express.Multer.File, kmsCode: string) { return this.sign(this.steps[3], document, kmsCode); }

  private async sign(step: StepConfig, document: Express.Multer.File, kmsCode: string): Promise<Buffer | null> {
    const form = new FormData();
    form.append('document[0]', document.buffer, { filename: document.originalname });
    form.append('kmsCode', kmsCode);
    form.append('profile', step.profile);
    form.append('hashAlgorithm', this.hashAlgorithm);
    form.append('signaturePackaging', this.signaturePackaging);
    form.append('canonicalizationMethod', this.canonicalizationMethod);
    form.append('signatureNodeName[0]', step.nodeName);
    form.append('signatureNodeNamespace[0]', step.namespace);
    form.append('isRemoveXPathExclusionFilter', step.removeXPathFilter);

    try {
      const resp = await axios.post<SignResponse>(`${this.baseUrl}/solidsign/dsig/xml/sign-kms`, form,
        { headers: { Authorization: this.authorization, ...form.getHeaders() }, timeout: 120000 });
      const doc = resp.data.documents?.[0];
      const href = doc?._links?.self?.href ?? doc?.links?.find((l) => l.rel === 'self')?.href;
      if (!href) { console.error('SolidSign response had no download link.'); return null; }

      const dl = await axios.get<ArrayBuffer>(href, {
        headers: { Authorization: this.authorization }, responseType: 'arraybuffer', timeout: 120000,
      });
      return Buffer.from(dl.data);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        console.error(`SolidSign API error ${err.response?.status}: ${JSON.stringify(err.response?.data)}`);
      } else {
        console.error(`Unexpected error during Diploma signing: ${(err as Error).message}`);
      }
      return null;
    }
  }
}
