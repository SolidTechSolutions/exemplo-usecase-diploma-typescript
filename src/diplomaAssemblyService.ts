'use strict';
/**
 * [EN]    Assembles the Diploma XML by copying the (already signed) <DadosDiploma> node out of
 *         the Documentação Acadêmica de Registro document and inserting it into the Diploma
 *         envelope template, right before <DadosRegistro>. Result is an UNSIGNED Diploma XML.
 * [PT-BR] Monta o XML do Diploma copiando o nó <DadosDiploma> (já assinado) da Documentação
 *         Acadêmica de Registro pro template do envelope Diploma, logo antes de <DadosRegistro>.
 *         O resultado é um XML AINDA NÃO ASSINADO.
 */
import fs from 'fs';
import path from 'path';
// @ts-ignore - @xmldom/xmldom ships its own types but the shape can lag behind DOM lib types
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'diploma-template.xml');

function findByLocalName(doc: any, localName: string): any {
  const all = doc.getElementsByTagNameNS('*', localName);
  return all.length > 0 ? all[0] : null;
}

export function assemble(signedDocumentacaoAcademicaXml: string): string | null {
  try {
    const academicDoc = new DOMParser().parseFromString(signedDocumentacaoAcademicaXml, 'text/xml');
    const dadosDiploma = findByLocalName(academicDoc, 'DadosDiploma');
    if (!dadosDiploma) {
      console.error('Could not find <DadosDiploma> in the supplied Documentação Acadêmica document.');
      return null;
    }

    const templateXml = fs.readFileSync(TEMPLATE_PATH, 'utf-8');
    const diplomaDoc = new DOMParser().parseFromString(templateXml, 'text/xml');
    const dadosRegistro = findByLocalName(diplomaDoc, 'DadosRegistro');
    const infDiploma = dadosRegistro.parentNode;

    const imported = dadosDiploma.cloneNode(true);
    infDiploma.insertBefore(imported, dadosRegistro);

    return new XMLSerializer().serializeToString(diplomaDoc);
  } catch (err) {
    console.error(`Unexpected error assembling the Diploma XML: ${(err as Error).message}`);
    return null;
  }
}
