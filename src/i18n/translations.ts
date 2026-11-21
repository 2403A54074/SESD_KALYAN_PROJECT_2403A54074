import type { LanguageCode } from '../types/system';

export interface TranslationDictionary {
  appShortTitle: string;
  navOverview: string;
  navCustody: string;
  navRelay: string;
  navWorkspace: string;
  navGovernance: string;
  quickCommand: string;
  focusMode: string;
  exitFocusMode: string;
  watermarkCta: string;
  footerCredit: string;
  greetingPrefix: string;
}

const DICTIONARIES: Record<LanguageCode, TranslationDictionary> = {
  en: {
    appShortTitle: 'Digital Document Watermarking & SMTP Relay',
    navOverview: 'Overview',
    navCustody: 'Document Custody',
    navRelay: 'SMTP & Webhook Relay',
    navWorkspace: 'Workspace & Tools',
    navGovernance: 'Governance & Studio',
    quickCommand: 'Search / Command',
    focusMode: 'Focus Mode',
    exitFocusMode: 'Exit Focus',
    watermarkCta: 'Watermark PDF',
    footerCredit: 'Developed by N. Kalyan Reddy',
    greetingPrefix: 'Workspace',
  },
  hi: {
    appShortTitle: 'डिजिटल दस्तावेज़ वॉटरमार्किंग और SMTP रिले',
    navOverview: 'अवलोकन',
    navCustody: 'दस्तावेज़ सुरक्षा',
    navRelay: 'SMTP और वेबहुक रिले',
    navWorkspace: 'कार्यक्षेत्र और उपकरण',
    navGovernance: 'प्रशासन और स्टूडियो',
    quickCommand: 'खोजें / कमांड',
    focusMode: 'फोकस मोड',
    exitFocusMode: 'फोकस बंद करें',
    watermarkCta: 'PDF वॉटरमार्क',
    footerCredit: 'Developed by N. Kalyan Reddy',
    greetingPrefix: 'कार्यक्षेत्र',
  },
  es: {
    appShortTitle: 'Marcado Digital de Documentos y Relé SMTP',
    navOverview: 'Resumen',
    navCustody: 'Custodia Documental',
    navRelay: 'Relé SMTP y Webhooks',
    navWorkspace: 'Espacio y Herramientas',
    navGovernance: 'Gobernanza y Estudio',
    quickCommand: 'Buscar / Comando',
    focusMode: 'Modo Enfoque',
    exitFocusMode: 'Salir Enfoque',
    watermarkCta: 'Marcar PDF',
    footerCredit: 'Developed by N. Kalyan Reddy',
    greetingPrefix: 'Espacio',
  },
};

export function getTranslations(lang: LanguageCode): TranslationDictionary {
  return DICTIONARIES[lang] || DICTIONARIES.en;
}
