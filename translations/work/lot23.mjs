// Lot 23 : anglais → [espagnol, italien]
const MISSING = (es, it, esLost, itLost) => [
  `Falta tu ${es} «{{path}}». Puede ser porque la eliminaste o, si está en una unidad extraíble, porque no está conectada.\nSi continúas, se creará una nueva, pero ${esLost}.\n\nSi moviste la carpeta o cambió la letra de la unidad, puedes buscar la nueva ubicación a mano, ¡pero asegúrate de elegir la carpeta correcta!`,
  `Manca la ${it} «{{path}}». Può succedere se l'hai eliminata o, se è su un'unità rimovibile, se non è collegata.\nSe continui, ne verrà creata una nuova, ma ${itLost}.\n\nSe hai spostato la cartella o è cambiata la lettera dell'unità, puoi cercare la nuova posizione a mano, ma fai molta attenzione a scegliere la cartella giusta!`,
];
export default {
  "Disk access failed repeatedly. If this is a removable disk (like a network or external drive), please ensure it's connected. Otherwise this may indicate filesystem corruption, you may want to run chkdsk or similar software to scan for problems.":
    [
      "El acceso al disco falló varias veces. Si es un disco extraíble (de red o externo), asegúrate de que esté conectado. Si no, puede indicar daños en el sistema de archivos; conviene analizarlo con Utilidad de Discos o similar.",
      "L'accesso al disco non è riuscito più volte. Se è un disco rimovibile (di rete o esterno), assicurati che sia collegato. Altrimenti può indicare danni al file system: conviene analizzarlo con Utility Disco o simili.",
    ],
  "mORTEX may have pre-selected some of the mods for you (if they were not referenced by any of your profiles) It's always a good idea to double check the mod itself in the staging folder before removing anything. The selected mods will be removed.":
    [
      "mORTEX puede haber preseleccionado algunos mods (si ningún perfil los usa). Conviene revisar el mod en la carpeta de preparación antes de quitar nada. Los mods seleccionados se quitarán.",
      "mORTEX potrebbe aver preselezionato alcune mod (se nessun profilo le usa). Conviene controllare la mod nella cartella di preparazione prima di rimuovere qualcosa. Le mod selezionate verranno rimosse.",
    ],
  "Please follow the instructions in the .NET installer. If you can't see the installer window, please check if it's hidden behind another window.[br][/br][br][/br]Please note: In rare cases you will need to restart windows before .NET works properly.":
    [
      "Sigue las instrucciones del instalador de .NET. Si no ves su ventana, comprueba si está detrás de otra.[br][/br][br][/br]Nota: en raras ocasiones hay que reiniciar Windows para que .NET funcione bien.",
      "Segui le istruzioni del programma di installazione di .NET. Se non vedi la finestra, controlla che non sia dietro un'altra.[br][/br][br][/br]Nota: in rari casi bisogna riavviare Windows perché .NET funzioni bene.",
    ],
  "An older version of this mod is already installed. You can replace the existing one - which will update all profiles - or install this one alongside it. In the latter case both versions will be available and only the active profile will be updated. ":
    [
      "Ya hay instalada una versión anterior de este mod. Puedes reemplazarla (se actualizarán todos los perfiles) o instalar esta junto a ella; en ese caso habrá dos versiones y solo se actualizará el perfil activo. ",
      "Una versione precedente di questa mod è già installata. Puoi sostituirla (verranno aggiornati tutti i profili) o installare questa accanto; in tal caso ci saranno due versioni e verrà aggiornato solo il profilo attivo. ",
    ],
  "The mod has no version number set. This isn't strictly necessary; we use the file ID to identify the exact version but for the purpose of informing the user it would be nicer if a version was specified. (Please don't forget to update the collection.)":
    [
      "El mod no tiene número de versión. No es imprescindible, ya que usamos el ID de archivo, pero sería mejor indicarla para informar al usuario. (No olvides actualizar la colección.)",
      "La mod non ha un numero di versione. Non è indispensabile, perché usiamo l'ID file, ma sarebbe meglio indicarla per informare l'utente. (Non dimenticare di aggiornare la collezione.)",
    ],
  "Symlinks on your system can only be created by an elevated process and your system just refused/failed to run the process elevated with no error message. Please check your system settings regarding User Access Control or use a different deployment method.":
    [
      "En tu sistema, los enlaces simbólicos solo los crea un proceso con privilegios, y el sistema se negó a ejecutarlo sin dar error. Revisa los ajustes de control de cuentas o usa otro método de despliegue.",
      "Sul sistema i collegamenti simbolici possono essere creati solo da un processo con privilegi, e il sistema ha rifiutato di avviarlo senza errori. Controlla le impostazioni del controllo account o usa un altro metodo di distribuzione.",
    ],
  " Note that the game you've created this collection for relies on a load order file which the game extension creates when deploying your mods - to ensure that the correct load order is published alongside this collection, please remember to deploy your mods!":
    [
      " El juego de esta colección usa un archivo de orden de carga que la extensión crea al desplegar los mods: para publicar el orden correcto con la colección, ¡acuérdate de desplegar tus mods!",
      " Il gioco di questa collezione usa un file dell'ordine di caricamento creato dall'estensione alla distribuzione delle mod: per pubblicare l'ordine giusto con la collezione, ricordati di distribuire le mod!",
    ],
  "Purging will remove all links deployed to the game directory.\nThis is not a destructive operation, on the next deployment all links will be restored.\nUse this operation to force a complete re-deployment or to restore the game directory to an unmodded-state.":
    [
      "Purgar quitará todos los enlaces desplegados en la carpeta del juego.\nNo es destructivo: en el próximo despliegue se restaurarán.\nÚsalo para forzar un despliegue completo o para dejar la carpeta del juego sin mods.",
      "La purga rimuove tutti i collegamenti distribuiti nella cartella del gioco.\nNon è distruttiva: alla prossima distribuzione verranno ripristinati.\nUsala per forzare una distribuzione completa o per riportare la cartella del gioco senza mod.",
    ],
  "The installed copy of LSLib/Divine is corrupted - please delete the existing LSLib mod entry and re-install it. Make sure to disable or add any necessary exceptions to your security software to ensure it does not interfere with Vortex/LSLib file operations.":
    [
      "La copia instalada de LSLib/Divine está dañada: elimina la entrada del mod LSLib y reinstálala. Desactiva o añade excepciones en tu software de seguridad para que no interfiera con Vortex/LSLib.",
      "La copia installata di LSLib/Divine è danneggiata: elimina la voce della mod LSLib e reinstallala. Disattiva o aggiungi eccezioni nel software di sicurezza perché non interferisca con Vortex/LSLib.",
    ],
  "Please be aware that toggling this only disables the interface for profiles, meaning profiles don't get deleted and an active profile doesn't get disabled. The last active profile for each game will still be used (i.e. its mod selection and local savegames).":
    [
      "Esto solo oculta la interfaz de perfiles: no se eliminan ni se desactiva el perfil activo. Se seguirá usando el último perfil activo de cada juego (su selección de mods y partidas locales).",
      "Questo nasconde solo l'interfaccia dei profili: non vengono eliminati né il profilo attivo disattivato. Verrà ancora usato l'ultimo profilo attivo di ogni gioco (selezione di mod e salvataggi locali).",
    ],
  "E.g.:\nSummary: Please add a way to see the size of a mod on disk\nRationale: Space on my games partition is too limited so I want to delete the biggest, uninstalled mods.\nProposed Implementation: Add a column to the mods page that shows the size of the mod size.":
    [
      "P. ej.:\nResumen: añadir una forma de ver el tamaño de un mod en disco\nMotivo: tengo poco espacio en la partición de juegos y quiero borrar los mods desinstalados más grandes.\nPropuesta: añadir a la página de mods una columna con el tamaño del mod.",
      "Es.:\nRiepilogo: aggiungere un modo per vedere la dimensione di una mod su disco\nMotivo: ho poco spazio nella partizione dei giochi e voglio eliminare le mod non installate più grandi.\nProposta: aggiungere alla pagina delle mod una colonna con la dimensione.",
    ],
  "Help us provide you with the best modding experience. With your permission, we will collect analytics information and send it to our team to help us improve quality and performance. This information is sent anonymously and will never be shared with a 3rd party.":
    [
      "Ayúdanos a ofrecerte la mejor experiencia de modding. Con tu permiso, recopilaremos datos de uso para mejorar la calidad y el rendimiento. Se envían de forma anónima y nunca se comparten con terceros.",
      "Aiutaci a offrirti la migliore esperienza di modding. Con il tuo permesso raccoglieremo dati d'uso per migliorare qualità e prestazioni. Sono inviati in forma anonima e mai condivisi con terzi.",
    ],
  "The game reset the list of active mods and ran without them.\nThis happens when an invalid or incompatible mod is installed. The game will not load any mods if one of them is incompatible, unfortunately there is no easy way to find out which one caused the problem.":
    [
      "El juego restableció la lista de mods activos y se ejecutó sin ellos.\nOcurre cuando hay un mod no válido o incompatible: el juego no carga ninguno si uno lo es, y no hay forma fácil de saber cuál causó el problema.",
      "Il gioco ha azzerato l'elenco delle mod attive ed è partito senza.\nSuccede quando è installata una mod non valida o incompatibile: il gioco non ne carica nessuna se una lo è, e non c'è un modo semplice per capire quale.",
    ],
  "The following enabled plugins declare a Blueprint plugin as a master. Starfield strips Blueprint masters from non-Blueprint plugins at load, which will break references and corrupt your save. These plugins must be disabled or rebuilt against a non-Blueprint master:":
    [
      "Estos plugins activados declaran un plugin Blueprint como master. Starfield quita esos masters al cargar, lo que rompe referencias y daña tu partida. Hay que desactivarlos o recompilarlos con un master que no sea Blueprint:",
      "Questi plugin attivi dichiarano un plugin Blueprint come master. Starfield rimuove questi master al caricamento, rompendo i riferimenti e danneggiando il salvataggio. Vanno disattivati o ricompilati con un master non Blueprint:",
    ],
  "You can only upload collections that are fully installed on this system.\nIf you have removed mods that were part of this collection you may want to remove them from the collection as well. If this collection is connected to a profile you can simply update from that.":
    [
      "Solo puedes subir colecciones instaladas por completo en este sistema.\nSi quitaste mods de esta colección, quítalos también de ella. Si está vinculada a un perfil, basta con actualizarla desde él.",
      "Puoi caricare solo collezioni installate completamente su questo sistema.\nSe hai rimosso mod di questa collezione, rimuovile anche da essa. Se è collegata a un profilo, basta aggiornarla da lì.",
    ],
  'LOOT reported a cyclic interaction between rules.<br />In the simplest case this is something like [i]"A needs to load after B"[/i] and [i]"B needs to load after A"[/i] but it can be more complicated, involving multiple plugins and groups and [i]their[/i] order.<br />':
    [
      "LOOT detectó una interacción cíclica entre reglas.<br />En el caso más simple es algo como [i]«A debe cargarse después de B»[/i] y [i]«B debe cargarse después de A»[/i], pero puede ser más complejo e implicar varios plugins, grupos y [i]su[/i] orden.<br />",
      "LOOT ha segnalato un'interazione ciclica tra regole.<br />Nel caso più semplice è qualcosa come [i]«A deve caricarsi dopo B»[/i] e [i]«B deve caricarsi dopo A»[/i], ma può essere più complesso e coinvolgere più plugin, gruppi e il [i]loro[/i] ordine.<br />",
    ],
  "A meta server provides additional information about mods, giving you more details and dependency information about them. By default you get this data from nexusmods.com but it's possible for others to set up their own servers and then you can add those here to use them.":
    [
      "Un servidor de metadatos da información adicional sobre los mods, como detalles y dependencias. Por defecto viene de nexusmods.com, pero otros pueden crear sus servidores y puedes añadirlos aquí.",
      "Un server dei metadati fornisce informazioni aggiuntive sulle mod, come dettagli e dipendenze. Per impostazione predefinita arrivano da nexusmods.com, ma altri possono creare i propri server e puoi aggiungerli qui.",
    ],
  "This collection has {{count}} optional mods which are not required to complete the installation but may provide additional features or options. You can view these mods before installing as they may change the default behavior of the collection or have additional requirements.":
    [
      "Esta colección tiene {{count}} mods opcionales, no necesarios para completar la instalación, que pueden añadir funciones u opciones. Puedes verlos antes de instalarlos, ya que pueden cambiar el comportamiento de la colección o tener requisitos adicionales.",
      "Questa collezione ha {{count}} mod facoltative, non necessarie per completare l'installazione, che possono aggiungere funzioni o opzioni. Puoi vederle prima di installarle, perché possono cambiare il comportamento della collezione o avere requisiti aggiuntivi.",
    ],
  "If enabled, when Vortex saves it's load order, it will also update the games load order. \n              If disabled, and you wish the game to use your load order, then this will need to be completed \n              manually using the Export to Game button on the load order screen":
    [
      "Si se activa, cuando Vortex guarde su orden de carga también actualizará el del juego. \n              Si no, y quieres que el juego use tu orden, tendrás que hacerlo \n              a mano con el botón Exportar al juego de la pantalla de orden de carga",
      "Se attivo, quando Vortex salva l'ordine di caricamento aggiornerà anche quello del gioco. \n              Se disattivo e vuoi che il gioco usi il tuo ordine, dovrai farlo \n              a mano con il pulsante Esporta nel gioco della schermata dell'ordine di caricamento",
    ],
  "You can fix this problem yourself by removing any mods that are not intended to be used with {{thisGame}}. If you downloaded these mods from the correct game site at Nexus Mods, you should inform the mod author of this issue. Archives for this game must be {{ext}} files (v{{ver}}).":
    [
      "Puedes corregirlo quitando los mods que no son para {{thisGame}}. Si los descargaste de la sección correcta de Nexus Mods, avisa al autor. Los archivos de este juego deben ser {{ext}} (v{{ver}}).",
      "Puoi risolvere rimuovendo le mod non pensate per {{thisGame}}. Se le hai scaricate dalla sezione giusta di Nexus Mods, avvisa l'autore. Gli archivi di questo gioco devono essere file {{ext}} (v{{ver}}).",
    ],
  'If you have multiple copies of the same mod installed (e.g. with different settings made) they will be merged into one line on the mod list between which you can toggle. Use the variant field to distinguish between them. E.g. you could have a "1k" and a "2k" variant of a mod installed.':
    [
      "Si tienes varias copias del mismo mod (p. ej. con ajustes distintos), se agrupan en una línea de la lista entre las que puedes alternar. Usa el campo variante para distinguirlas, p. ej. una variante «1k» y otra «2k».",
      "Se hai più copie della stessa mod (es. con impostazioni diverse), vengono raggruppate in una riga dell'elenco tra cui puoi alternare. Usa il campo variante per distinguerle, es. una variante «1k» e una «2k».",
    ],
  "The Remastered edition stores its scripts in a different text encoding to earlier releases, and mods that need merging were generally built against the old one. Merging them may produce corrupted scripts.\n\nMods written for the Remastered edition merge themselves and do not need this tool.":
    [
      "La edición Remastered guarda sus scripts con otra codificación, y los mods que necesitan fusión suelen basarse en la antigua. Fusionarlos puede dañar los scripts.\n\nLos mods escritos para la edición Remastered se fusionan solos y no necesitan esta herramienta.",
      "L'edizione Remastered salva gli script con un'altra codifica, e le mod da unire di solito si basano su quella vecchia. Unirle può danneggiare gli script.\n\nLe mod scritte per l'edizione Remastered si uniscono da sole e non serve questo strumento.",
    ],
  "Cloning a collection means you can make edits to the collection in the workshop and share your changes with the community.\nIf this collection is your own, your uploads will be revisions of that existing collection, otherwise you will create a new collection associated with your own account.":
    [
      "Clonar una colección te permite editarla en el workshop y compartir los cambios con la comunidad.\nSi es tuya, tus subidas serán revisiones de esa colección; si no, crearás una nueva asociada a tu cuenta.",
      "Clonare una collezione ti permette di modificarla nel workshop e condividere le modifiche con la comunità.\nSe è tua, i caricamenti saranno revisioni di quella collezione; altrimenti ne creerai una nuova associata al tuo account.",
    ],
  "Every dashlet (the widgets on the Dashboards) has a height that is a multiple of this value and a width of either 1/3, 2/3 or 3/3 of the window width. Here you can adjust the base height of dashlets but we can't promise every dashlet will look good or even be usable with non-default height.":
    [
      "Cada widget del panel tiene una altura múltiplo de este valor y un ancho de 1/3, 2/3 o 3/3 de la ventana. Aquí puedes ajustar la altura base, pero no garantizamos que todos se vean bien o sean usables con una altura distinta.",
      "Ogni widget del pannello ha un'altezza multipla di questo valore e una larghezza di 1/3, 2/3 o 3/3 della finestra. Qui puoi regolare l'altezza base, ma non garantiamo che tutti siano belli o utilizzabili con un'altezza diversa.",
    ],
  "Windows reported an error message regarding \"{{filePath}}\" that indicates the containing folder has limitations that make it unsuitable for what it's being used. A common example of this is if you try to put the staging folder on a OneDrive folder because OneDrive can't deal with hardlinks.":
    [
      "El sistema informó de un error sobre «{{filePath}}»: la carpeta que lo contiene tiene limitaciones que la hacen inadecuada. Un ejemplo típico es poner la carpeta de preparación en OneDrive, que no admite enlaces duros.",
      "Il sistema ha segnalato un errore su «{{filePath}}»: la cartella che lo contiene ha limitazioni che la rendono inadatta. Un esempio tipico è mettere la cartella di preparazione su OneDrive, che non gestisce gli hard link.",
    ],
  "The collection you just installed set up tools to be run from the dashboard, however not all were found locally. It's possible that these tools will be available after the next deployment completes, otherwise you may have to edit the configuration for the tool to adjust them to your own setup.":
    [
      "La colección que instalaste configuró herramientas para el panel, pero no todas se encontraron. Puede que estén disponibles tras el próximo despliegue; si no, tendrás que ajustar su configuración a tu equipo.",
      "La collezione appena installata ha configurato strumenti da avviare dal pannello, ma non tutti sono stati trovati. Potrebbero essere disponibili dopo la prossima distribuzione; altrimenti dovrai adattarne la configurazione.",
    ],
  'The collection "[b]{{collectionName}}[/b]" has been classified as adult content because it contains: nudity, sexualisation, extreme violence and gore, or excessive profanity.<br/><br/>Your site preferences are set to hide adult content, you can update your preferences on the Nexus Mods website.':
    [
      "La colección «[b]{{collectionName}}[/b]» se clasificó como contenido para adultos porque contiene desnudos, sexualización, violencia extrema o lenguaje muy soez.<br/><br/>Tus preferencias del sitio ocultan este contenido; puedes cambiarlas en el sitio de Nexus Mods.",
      "La collezione «[b]{{collectionName}}[/b]» è classificata come contenuto per adulti perché contiene nudità, sessualizzazione, violenza estrema o linguaggio volgare.<br/><br/>Le preferenze del sito nascondono questi contenuti; puoi modificarle sul sito di Nexus Mods.",
    ],
  "You can not put mods into the game directory. This directory is under the control of the game (and potentially Steam or similar) so your mods might be deleted or moved or otherwise damaged by foreign software.\nPlease choose a separate folder for staging folder, one that no other application uses.":
    [
      "No puedes poner mods en la carpeta del juego: la controla el juego (y quizá Steam u otros), así que otros programas podrían borrar, mover o dañar tus mods.\nElige para la preparación una carpeta aparte que no use ninguna otra aplicación.",
      "Non puoi mettere le mod nella cartella del gioco: è controllata dal gioco (e forse da Steam o simili), quindi altri programmi potrebbero eliminarle, spostarle o danneggiarle.\nScegli per la preparazione una cartella separata, non usata da altre applicazioni.",
    ],
  "In version 17 of the game 7 Days to Die the way mods are installed has changed considerably. Unfortunately we are now not able to support this change with the way mods were previously installed.\nThis means that for the mods to work correctly you have to reinstall them.\nWe are sorry for the inconvenience.":
    [
      "En la versión 17 de 7 Days to Die cambió mucho la forma de instalar mods y no podemos adaptar los mods instalados antes.\nPara que funcionen, tendrás que reinstalarlos.\nDisculpa las molestias.",
      "Nella versione 17 di 7 Days to Die il modo di installare le mod è cambiato molto e non possiamo adattare quelle installate prima.\nPer farle funzionare dovrai reinstallarle.\nCi scusiamo per l'inconveniente.",
    ],
  "Some of the enabled mods either contain no files or all files they do contain are entirely overwritten by another mod. These redundant mods don't do any harm except slow down deployment a bit.\nIf you believe this to be a mistake, please check the file conflicts [svg]conflict[/svg] for the mod in question.":
    [
      "Algunos mods activados no tienen archivos o todos los suyos los sobrescribe otro mod. Estos mods redundantes no causan daño, solo ralentizan un poco el despliegue.\nSi crees que es un error, revisa los conflictos de archivos [svg]conflict[/svg] de ese mod.",
      "Alcune mod attive non contengono file o tutti i loro file sono sovrascritti da un'altra mod. Queste mod ridondanti non fanno danni, rallentano solo un po' la distribuzione.\nSe pensi che sia un errore, controlla i conflitti di file [svg]conflict[/svg] della mod.",
    ],
  "This action will set priorities by sorting mod folder names alphabetically, which is the order the game itself uses when no priority is set. Are you sure you wish to proceed ?[br][/br][br][/br]Merged scripts stay locked at the top. Everything else is reordered, including mods added manually or by other tools.":
    [
      "Esta acción fijará prioridades ordenando alfabéticamente los nombres de carpetas, el orden que usa el juego sin prioridad. ¿Seguro que quieres continuar?[br][/br][br][/br]Los scripts fusionados quedan fijados arriba. Todo lo demás se reordena, incluidos los mods añadidos a mano o por otras herramientas.",
      "Questa azione imposterà le priorità ordinando alfabeticamente i nomi delle cartelle, l'ordine usato dal gioco senza priorità. Vuoi davvero procedere?[br][/br][br][/br]Gli script uniti restano bloccati in cima. Tutto il resto viene riordinato, comprese le mod aggiunte a mano o da altri strumenti.",
    ],
  'The game store has changed from "{{oldStore}}" to "{{newStore}}".\n\nSome mods, mod loaders, and tools such as UE4SS or Script Extenders install files into store-specific directories (e.g. win64 for Steam vs winGDK for Xbox). These may need to be re-installed for the game to function correctly at the new location.':
    [
      "La tienda del juego cambió de «{{oldStore}}» a «{{newStore}}».\n\nAlgunos mods, cargadores y herramientas como UE4SS o Script Extender instalan archivos en carpetas propias de cada tienda (p. ej. win64 en Steam frente a winGDK en Xbox). Puede que haya que reinstalarlos.",
      "Il negozio del gioco è passato da «{{oldStore}}» a «{{newStore}}».\n\nAlcune mod, loader e strumenti come UE4SS o Script Extender installano file in cartelle specifiche del negozio (es. win64 per Steam e winGDK per Xbox). Potrebbe essere necessario reinstallarli.",
    ],
  "Nexus Mods does not use self-signed certificates. This error signifies that your network connection seems to be proxied, either by malware or a badly developed firewall, AV, VPN, http proxy; causing valid SSL certificates to not be recognized. Please review your system and its network connection before trying again.":
    [
      "Nexus Mods no usa certificados autofirmados. Este error indica que tu conexión pasa por un intermediario (malware o un cortafuegos, antivirus, VPN o proxy mal hecho) que impide reconocer certificados válidos. Revisa tu sistema y tu red antes de reintentar.",
      "Nexus Mods non usa certificati autofirmati. Questo errore indica che la connessione passa da un intermediario (malware o firewall, antivirus, VPN o proxy mal fatti) che impedisce di riconoscere certificati validi. Controlla il sistema e la rete prima di riprovare.",
    ],
  'Your "{{dirPath}}" folder is either missing/inaccessible, or appears to not contain all the required maps. This is usually an indication that you do not have Halo: CE Multiplayer installed. Some mods may not work properly due to a bug in the game engine. Please ensure you have installed CE MP through your game store.':
    [
      "La carpeta «{{dirPath}}» falta, no es accesible o no contiene todos los mapas necesarios. Suele indicar que no tienes instalado Halo: CE Multiplayer. Algunos mods pueden fallar por un error del motor. Instala CE MP desde tu tienda.",
      "La cartella «{{dirPath}}» manca, non è accessibile o non contiene tutte le mappe necessarie. Di solito indica che Halo: CE Multiplayer non è installato. Alcune mod potrebbero non funzionare per un bug del motore. Installa CE MP dal tuo negozio.",
    ],
  "Mod deployment {{more}} is pending.[br][/br]This means that changes made to mods such as updating, enabling/disabling, as well as newly set mod rules need to be deployed to take effect.[br][/br]You can skip this step, ignoring (but not reverting) newly made changes to mods and mod rules, or deploy now to commit the changes.":
    [
      "Hay un despliegue de mods {{more}} pendiente.[br][/br]Los cambios en mods (actualizaciones, activaciones) y las nuevas reglas deben desplegarse para surtir efecto.[br][/br]Puedes omitirlo, ignorando (sin revertir) los cambios, o desplegar ahora para aplicarlos.",
      "C'è una distribuzione delle mod {{more}} in sospeso.[br][/br]Le modifiche alle mod (aggiornamenti, attivazioni) e le nuove regole vanno distribuite per avere effetto.[br][/br]Puoi saltare questo passaggio, ignorando (senza annullare) le modifiche, o distribuire ora per applicarle.",
    ],
  "With your permission, we will collect analytics information and send it to our team to help us improve quality and performance. This information is sent anonymously and will never be shared with a 3rd party.[br][/br][br][/br][url={{help-article}}]More about the data we track[/url] | [url={{privacy-policy}}]Privacy Policy[/url]":
    [
      "Con tu permiso, recopilaremos datos de uso para mejorar la calidad y el rendimiento. Se envían de forma anónima y nunca se comparten con terceros.[br][/br][br][/br][url={{help-article}}]Más sobre los datos que recogemos[/url] | [url={{privacy-policy}}]Política de privacidad[/url]",
      "Con il tuo permesso raccoglieremo dati d'uso per migliorare qualità e prestazioni. Sono inviati in forma anonima e mai condivisi con terzi.[br][/br][br][/br][url={{help-article}}]Altro sui dati raccolti[/url] | [url={{privacy-policy}}]Informativa sulla privacy[/url]",
    ],
  'Your downloads folder "{{path}}" is missing. This might happen because you deleted it or - if you have it on a removable drive - it is not currently connected.\nIf you continue now, a new downloads folder will be created but all your previous mod archives will be lost.\n\nIf you have moved the folder or the drive letter changed, you can browse for the new location manually, but please be extra careful to select the right folder!':
    MISSING(
      "carpeta de descargas",
      "cartella dei download",
      "se perderán todos tus archivos de mods anteriores",
      "andranno persi tutti gli archivi delle mod precedenti",
    ),
  'Your mod staging folder "{{path}}" is missing. This might happen because you deleted it or - if you have it on a removable drive - it is not currently connected.\nIf you continue now, a new staging folder will be created but all your previously managed mods will be lost.\n\nIf you have moved the folder or the drive letter changed, you can browse for the new location manually, but please be extra careful to select the right folder!':
    MISSING(
      "carpeta de preparación de mods",
      "cartella di preparazione delle mod",
      "se perderán todos los mods que gestionabas",
      "andranno perse tutte le mod gestite finora",
    ),
};
