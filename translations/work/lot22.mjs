// Lot 22 : anglais → [espagnol, italien]
const FOLDER = (esF, itF, esS, itS) => [
  `No se pudo crear la ${esF}. [b][color=red]Debes[/color][/b] ir a ${esS} y elegir una carpeta válida [b][color=red]antes de hacer nada más[/color][/b] o verás más errores.`,
  `Impossibile creare la ${itF}. [b][color=red]Devi[/color][/b] andare in ${itS} e sceglierne una valida [b][color=red]prima di fare qualsiasi altra cosa[/color][/b], o vedrai altri errori.`,
];
export default {
  "The profile you just deleted had savegames associated with it. Do you want to remove those savegames now? If you don't, they will still be on disk in {{savesPath}} but they won't show up in the game until you move them.":
    [
      "El perfil que eliminaste tenía partidas asociadas. ¿Quieres quitarlas ahora? Si no, seguirán en el disco en {{savesPath}}, pero no aparecerán en el juego hasta que las muevas.",
      "Il profilo eliminato aveva dei salvataggi associati. Vuoi rimuoverli ora? Altrimenti resteranno sul disco in {{savesPath}}, ma non compariranno nel gioco finché non li sposti.",
    ],
  'Please note that this is not "Undo"! This screen allows you to revert specific actions but we make no promises that this actually returns mORTEX or your game to the state before that action. Not every Action can be undone.':
    [
      "¡Esto no es «Deshacer»! Esta pantalla permite revertir acciones concretas, pero no garantiza que mORTEX o tu juego vuelvan al estado anterior. No todas las acciones se pueden deshacer.",
      "Attenzione: non è «Annulla»! Questa schermata permette di annullare azioni specifiche, ma non garantisce che mORTEX o il gioco tornino allo stato precedente. Non tutte le azioni si possono annullare.",
    ],
  "Export can be used to manually update the game's modsettings.lsx file if 'Settings > Mods > Auto export load order' isn't set to do this automatically. \n        It can also be used to export to a different file as a backup.":
    [
      "Exportar sirve para actualizar a mano el modsettings.lsx del juego si «Ajustes > Mods > Exportar orden de carga automáticamente» no lo hace. \n        También sirve para exportar a otro archivo como copia.",
      "Esporta serve ad aggiornare a mano il file modsettings.lsx del gioco se «Impostazioni > Mod > Esporta automaticamente l'ordine di caricamento» non lo fa. \n        Serve anche a esportare in un altro file come backup.",
    ],
  "This collection has been uploaded with a different account ({{uploadAuthor}}) than you're using now ({{currentUser}}). If you edit and upload this collection now it will be uploaded as a new collection by your current user.":
    [
      "Esta colección se subió con otra cuenta ({{uploadAuthor}}) distinta de la actual ({{currentUser}}). Si la editas y subes ahora, se publicará como nueva colección de tu usuario actual.",
      "Questa collezione è stata caricata con un altro account ({{uploadAuthor}}) diverso da quello attuale ({{currentUser}}). Se la modifichi e la carichi ora, verrà pubblicata come nuova collezione del tuo utente.",
    ],
  'This change will only be applied once you choose to "Save" the change in the main dialogue window. Please be aware that once saved, this action cannot be undone and the mod rules and file overrides will have to be set again.':
    [
      "Este cambio se aplicará cuando pulses «Guardar» en la ventana principal. Una vez guardado no se puede deshacer, y habrá que volver a definir las reglas de mods y las prioridades de archivos.",
      "Questa modifica verrà applicata quando sceglierai «Salva» nella finestra principale. Una volta salvata non si può annullare e regole delle mod e priorità dei file andranno reimpostate.",
    ],
  'Your userlist contains multiple identical "{{plugin}} after {{reference}}"rules. LOOT will not be able to sort plugins with this userlist.\nTo fix this, please close vortex and remove duplicate entries from "{{userlistPath}}".':
    [
      "Tu lista de usuario contiene varias reglas idénticas «{{plugin}} después de {{reference}}». LOOT no podrá ordenar los plugins con ella.\nPara corregirlo, cierra Vortex y quita las entradas duplicadas de «{{userlistPath}}».",
      "La lista utente contiene più regole identiche «{{plugin}} dopo {{reference}}». LOOT non potrà ordinare i plugin con questa lista.\nPer correggerlo, chiudi Vortex e rimuovi le voci duplicate da «{{userlistPath}}».",
    ],
  "You can adjust the load order for The Witcher 3 by dragging and dropping mods up or down on this page.  If you are using several mods that add scripts you may need to use the Witcher 3 Script merger. For more information see: ":
    [
      "Puedes ajustar el orden de carga de The Witcher 3 arrastrando los mods arriba o abajo en esta página.  Si usas varios mods que añaden scripts, puede que necesites Witcher 3 Script Merger. Más información: ",
      "Puoi regolare l'ordine di caricamento di The Witcher 3 trascinando le mod su o giù in questa pagina.  Se usi più mod che aggiungono script, potrebbe servire Witcher 3 Script Merger. Per maggiori informazioni: ",
    ],
  "The extension \"{{ name }}\" wasn't found in the repository. This might mean that the extension isn't available at all or has been excluded for compatibility reasons. Please check the installation instructions for this extension.":
    [
      "No se encontró la extensión «{{ name }}» en el repositorio. Puede que no esté disponible o se haya excluido por compatibilidad. Revisa sus instrucciones de instalación.",
      "L'estensione «{{ name }}» non è stata trovata nel repository. Potrebbe non essere disponibile o essere stata esclusa per compatibilità. Controlla le sue istruzioni di installazione.",
    ],
  "The staging folder could not be created. You [b][color=red]have[/color][/b] to go to settings->mods and change it to a valid directory [b][color=red]before doing anything else[/color][/b] or you will get further error messages.":
    FOLDER(
      "carpeta de preparación",
      "cartella di preparazione",
      "Ajustes > Mods",
      "Impostazioni > Mod",
    ),
  "This collection was created using a different version of the game than you have and is the most common reason why a collection doesn't work correctly.\n\nYour version: {{gameVersion}}\n\nCollection version: {{collectionGameVersion}}":
    [
      "Esta colección se creó con otra versión del juego, el motivo más habitual de que una colección no funcione bien.\n\nTu versión: {{gameVersion}}\n\nVersión de la colección: {{collectionGameVersion}}",
      "Questa collezione è stata creata con un'altra versione del gioco, il motivo più comune per cui una collezione non funziona bene.\n\nLa tua versione: {{gameVersion}}\n\nVersione della collezione: {{collectionGameVersion}}",
    ],
  "Below is a preview of the load order for the mods that are included in the current collection. If you wish to modify the load please do so by opening the Load Order page; any changes made there will be reflected in this collection.":
    [
      "Abajo tienes una vista previa del orden de carga de los mods de la colección. Para modificarlo, abre la página de orden de carga; los cambios se reflejarán en la colección.",
      "Qui sotto c'è un'anteprima dell'ordine di caricamento delle mod della collezione. Per modificarlo, apri la pagina dell'ordine di caricamento; le modifiche si rifletteranno nella collezione.",
    ],
  'The option to "prefer exact" version only works with sources that support mod updates (Nexus Mods). For other sources your options are to use the exact same version you have locally or to accept whatever version the user downloads.':
    [
      "La opción «Preferir exacta» solo funciona con orígenes que admiten actualizaciones (Nexus Mods). Para otros, puedes usar exactamente tu versión local o aceptar la que descargue el usuario.",
      "L'opzione «Preferisci esatta» funziona solo con le origini che supportano gli aggiornamenti (Nexus Mods). Per le altre puoi usare esattamente la tua versione locale o accettare quella scaricata dall'utente.",
    ],
  "Your userlist refers to groups that don't exist: {{missing}}[br][/br]The most likely reason is that the masterlist has changed and dropped the group.[br][/br]This can be fixed automatically by removing all references to these groups.":
    [
      "Tu lista de usuario hace referencia a grupos inexistentes: {{missing}}[br][/br]Lo más probable es que la masterlist haya cambiado y quitado el grupo.[br][/br]Se puede corregir automáticamente quitando todas las referencias a estos grupos.",
      "La lista utente fa riferimento a gruppi inesistenti: {{missing}}[br][/br]Probabilmente la masterlist è cambiata e ha eliminato il gruppo.[br][/br]Si può correggere automaticamente rimuovendo tutti i riferimenti a questi gruppi.",
    ],
  "If checked, when you install a mod for Stardew Valley you may get suggestions for installing further mods, required or recommended by it.This information could be wrong or incomplete so please carefully consider before accepting them.":
    [
      "Si se marca, al instalar un mod de Stardew Valley podrás recibir sugerencias de otros mods necesarios o recomendados. Esta información puede ser incorrecta o incompleta, así que piénsalo antes de aceptar.",
      "Se selezionata, installando una mod di Stardew Valley potresti ricevere suggerimenti per altre mod richieste o consigliate. Queste informazioni possono essere errate o incomplete: valuta bene prima di accettare.",
    ],
  "The downloads folder could not be created. You [b][color=red]have[/color][/b] to go to settings->downloads and change it to a valid directory [b][color=red]before doing anything else[/color][/b] or you will get further error messages.":
    FOLDER(
      "carpeta de descargas",
      "cartella dei download",
      "Ajustes > Descargas",
      "Impostazioni > Download",
    ),
  'The installer in "{{name}}" tried to install files that were not part of the archive.\n This can be due to an invalid mod or an invalid game extension installer.\nPlease report this to the mod author and/or the game extension developer.':
    [
      "El instalador de «{{name}}» intentó instalar archivos que no estaban en el archivo comprimido.\n Puede deberse a un mod o a un instalador de extensión no válidos.\nInforma al autor del mod o al desarrollador de la extensión.",
      "Il programma di installazione di «{{name}}» ha provato a installare file non presenti nell'archivio.\n Può dipendere da una mod o da un'estensione non valide.\nSegnalalo all'autore della mod o allo sviluppatore dell'estensione.",
    ],
  'Deleting a collection will not remove the mods that have been added to it.\n\nAny changes made to this collection since the last upload to Nexus Mods will be lost.\n\nAre you sure you want to remove "{{collectionName}}" from your Workshop?':
    [
      "Eliminar una colección no quita los mods añadidos.\n\nSe perderán los cambios hechos desde la última subida a Nexus Mods.\n\n¿Seguro que quieres quitar «{{collectionName}}» de tu Workshop?",
      "Eliminare una collezione non rimuove le mod aggiunte.\n\nLe modifiche fatte dall'ultimo caricamento su Nexus Mods andranno perse.\n\nVuoi davvero rimuovere «{{collectionName}}» dal Workshop?",
    ],
  "You can resolve a cycle by either removing or flipping one rule, so if you have a cycle A->-B->-C->-A you could flip the arrow between C and A to get A->-B->-C-<-A which is no longer a cycle. Repeat this until there are no cycles left.":
    [
      "Puedes resolver un ciclo quitando o invirtiendo una regla: con un ciclo A->-B->-C->-A, invierte la flecha entre C y A para obtener A->-B->-C-<-A, que ya no es un ciclo. Repite hasta que no queden ciclos.",
      "Puoi risolvere un ciclo rimuovendo o invertendo una regola: con un ciclo A->-B->-C->-A, inverti la freccia tra C e A per ottenere A->-B->-C-<-A, che non è più un ciclo. Ripeti finché non restano cicli.",
    ],
  "Please be aware that mORTEX is based on Electron which in turn is based on Chrome, but it will not always be the newest version. Also, we can't rule out that electron might contain it's own security issues pertaining to website access.":
    [
      "mORTEX se basa en Electron, que a su vez se basa en Chrome, pero no siempre en su última versión. Tampoco podemos descartar que Electron tenga sus propios problemas de seguridad al acceder a sitios web.",
      "mORTEX si basa su Electron, che a sua volta si basa su Chrome, ma non sempre sulla versione più recente. Non possiamo escludere che Electron abbia problemi di sicurezza propri nell'accesso ai siti.",
    ],
  "The error was unhandled which may lead to unforeseen consequences including data loss. Continue at your own risk. Please do not report any issues that arise from here on out, as they are very likely to be caused by the unhandled error. ":
    [
      "El error no se controló, lo que puede tener consecuencias imprevistas, incluida la pérdida de datos. Continúa bajo tu responsabilidad. No informes de problemas posteriores: probablemente los cause este error. ",
      "L'errore non è stato gestito e può avere conseguenze impreviste, inclusa la perdita di dati. Continua a tuo rischio. Non segnalare i problemi successivi: probabilmente sono causati da questo errore. ",
    ],
  "Unable to finalize downloads folder creation/transfer. Please ensure your OS account has full read/write permissions for the target destination and try again. An exception should be added to Anti-Virus apps for Vortex. (where applicable)":
    [
      "No se pudo terminar de crear o transferir la carpeta de descargas. Asegúrate de que tu cuenta tenga permisos completos de lectura y escritura en el destino e inténtalo de nuevo. Añade una excepción para Vortex en tu antivirus (si procede).",
      "Impossibile completare la creazione o il trasferimento della cartella dei download. Assicurati che l'account abbia pieni permessi di lettura e scrittura sulla destinazione e riprova. Aggiungi un'eccezione per Vortex nell'antivirus (se necessario).",
    ],
  "Plugins shouldn't exceed mod index {{maxIndex}} for a total of {{count}} plugins (including base game and DLCs) as the game will behave oddly otherwise. Please disable or attempt to mark plugins as light (if applicable) in the Plugins page":
    [
      "Los plugins no deben superar el índice {{maxIndex}}, es decir {{count}} plugins en total (juego base y DLC incluidos), o el juego se comportará de forma extraña. Desactiva plugins o márcalos como ligeros (si es posible) en la página Plugins",
      "I plugin non devono superare l'indice {{maxIndex}}, cioè {{count}} plugin in totale (gioco base e DLC inclusi), altrimenti il gioco si comporterà in modo strano. Disattiva dei plugin o segnali come leggeri (se possibile) nella pagina Plugin",
    ],
  'The currently identified game store for your selected game directory is: "{{gameStore}}".[br][/br][br][/br]If this is not the correct game store, please choose below. (Games can have game store specific folder structures)[br][/br][br][/br]':
    [
      "La tienda detectada para la carpeta del juego elegida es: «{{gameStore}}».[br][/br][br][/br]Si no es la correcta, elígela abajo. (Cada tienda puede tener su propia estructura de carpetas)[br][/br][br][/br]",
      "Il negozio rilevato per la cartella del gioco scelta è: «{{gameStore}}».[br][/br][br][/br]Se non è quello giusto, sceglilo qui sotto. (Ogni negozio può avere una struttura di cartelle propria)[br][/br][br][/br]",
    ],
  "E.g.:\nSummary: The mod downloads properly but when I try to install it nothing happens.\nExpected Results: The mod is installed.\nActual Results: Nothing happens.\nSteps to reproduce: Download a mod, then click Install inside the Actions menu.":
    [
      "P. ej.:\nResumen: el mod se descarga bien, pero al instalarlo no pasa nada.\nResultado esperado: el mod se instala.\nResultado real: no pasa nada.\nPasos para reproducir: descarga un mod y pulsa Instalar en el menú Acciones.",
      "Es.:\nRiepilogo: la mod si scarica correttamente, ma installandola non succede nulla.\nRisultato atteso: la mod viene installata.\nRisultato effettivo: non succede nulla.\nPassaggi per riprodurre: scarica una mod, poi fai clic su Installa nel menu Azioni.",
    ],
  "You're updating a mod that others depend upon and the update doesn't seem to be compatible (according to the dependency information). If you continue we have to disable these dependencies, otherwise you'll continually get warnings about it.":
    [
      "Actualizas un mod del que dependen otros y la actualización no parece compatible (según la información de dependencias). Si continúas, desactivaremos esas dependencias; si no, recibirás avisos continuos.",
      "Stai aggiornando una mod da cui altre dipendono e l'aggiornamento non sembra compatibile (secondo le informazioni sulle dipendenze). Se continui, disattiveremo queste dipendenze, altrimenti riceverai avvisi continui.",
    ],
};
