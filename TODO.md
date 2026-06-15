FO:
  - page pour créer un ticket, on peut associer plusieurs éléments au 
ticket
  -  Créer la page pour afficher la liste des éléments 
      - avec recherche multi critère 

BO:
  - Dashboard pour afficher  
      - le nombre d’éléments général, avec détails par type 
      - le nombre de ticket général, avec détail par type 
  - Page pour afficher les tickets , avec une fiche. 
  - une page avec un bouton pour réinitialiser les données 
  -  créer la page pour importer les 4 fichiers(4 input files)  
      - 3 fichiers csv pour le contenu    
      - 1 fichier zip pour les images


les tickets terminés peut etre encore en progress et il doit y avoir une boite dialogue et un bouton annulation , donc quand on clique sur ceci , le super cout saisie dernièrement dans le terminé est supprimé 

bouton
réouverture , 
champs en pourcentage par exemple 10% ceci est un cout de réouverture (cout en +), 
ce cout est stocké dans SQlite 

categorie , super_cost , cout réouverture , cout total 


nouvelle page pour import les mouvements des couts
csv 3 colonnes 
colonne 1 :ticket 
colonne 2: mvt
colonne 3: valeur 

ex: colonne 1 : 2
    colonne 2: open 
    colonne 3 : 5 

    colonne 1 : 2 
    colonne 2 : cancel 
    colonne : 

    colonne 1 : 2 
    colonne : closed
    colonne 3 : 100

dans le tableau cout , lorsque je clique sur une categorie , il y a détail des assets 