# Backend Spring Boot + SQLite

## Architecture

```
gpli-backend/
├── entity/         ← Entités JPA (TicketCost, KanbanSettings...)
├── repository/     ← Interfaces Spring Data JPA
├── service/        ← Logique métier
└── controller/     ← Endpoints REST (@RestController)
```

Base de données : **SQLite** via `spring.jpa.hibernate.ddl-auto=update` (les tables sont créées automatiquement au démarrage si elles n'existent pas).

---

## Entité TicketCost

```java
@Entity
public class TicketCost {
    @Id @GeneratedValue
    private Integer id;
    private Integer ticketId;
    private String  ticketTitle;
    private Double  fixedCost;
    private Integer itemCount;
    private String  itemTypes;    // JSON : '["Computer","Monitor"]'
    private String  source;       // 'kanban' | 'reopen' | 'glpi'
    private String  createdAt;    // ISO 8601
}
```

---

## Endpoints disponibles

### TicketCost

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/ticket-costs` | Tous les coûts |
| `POST` | `/api/ticket-costs` | Créer un coût |
| `GET` | `/api/ticket-costs/ticket/{id}` | Coûts d'un ticket |
| `GET` | `/api/ticket-costs/ticket/{id}/latest` | Dernier coût d'un ticket |
| `DELETE` | `/api/ticket-costs/ticket/{id}/latest` | Supprimer le dernier coût |

---

## Repository — méthodes JPA

```java
public interface TicketCostRepository extends JpaRepository<TicketCost, Integer> {
    List<TicketCost> findByTicketId(Integer ticketId);

    // Dernier coût enregistré pour un ticket
    Optional<TicketCost> findTopByTicketIdOrderByCreatedAtDesc(Integer ticketId);
}
```

---

## Service — méthodes principales

```java
// Récupérer tous les coûts
List<TicketCost> getAll()

// Enregistrer un coût
TicketCost save(TicketCost cost)

// Dernier coût d'un ticket
Optional<TicketCost> getLatestByTicketId(Integer ticketId)

// Supprimer le dernier coût d'un ticket
boolean deleteLatestByTicketId(Integer ticketId)
```

---

## Appels depuis Vue (ticketCostService.ts)

```ts
import axios from 'axios'
const BASE = '/api/ticket-costs'

// POST — créer un coût
await axios.post(BASE, payload)

// GET — tous les coûts
await axios.get(BASE)

// GET — dernier coût d'un ticket
await axios.get(`${BASE}/ticket/${ticketId}/latest`)

// DELETE — supprimer le dernier coût
await axios.delete(`${BASE}/ticket/${ticketId}/latest`)
```

Le proxy Vite redirige `/api/**` vers `http://localhost:8080` en développement (configuré dans `vite.config.ts`).

---

## Configuration Spring Boot (application.properties)

```properties
spring.datasource.url=jdbc:sqlite:gpli.db
spring.datasource.driver-class-name=org.sqlite.JDBC
spring.jpa.hibernate.ddl-auto=update
spring.jpa.database-platform=org.hibernate.community.dialect.SQLiteDialect
```

---

## Ajouter une nouvelle entité

1. Créer `entity/MonEntite.java` avec `@Entity`, `@Id`, `@GeneratedValue`
2. Créer `repository/MonEntiteRepository.java` extends `JpaRepository<MonEntite, Integer>`
3. Créer `service/MonEntiteService.java` avec `@Service`
4. Créer `controller/MonEntiteController.java` avec `@RestController` et `@RequestMapping("/api/mon-entite")`
5. Au démarrage, Hibernate crée la table automatiquement (`ddl-auto=update`)
