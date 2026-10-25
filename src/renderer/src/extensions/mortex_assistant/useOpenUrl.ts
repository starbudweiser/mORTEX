/** Ouvre une adresse dans le navigateur du système (action existante de l'appli). */
export const useOpenUrl = () => (url: string) => {
  window.api.shell.openUrl(url);
};
