# Règles — Backend Laravel (app/)

## Conventions
- PSR-12, PHP 8.2+
- Nommage : Controllers en PascalCase, méthodes en camelCase
- Services dans `app/Services/`, un service = une responsabilité
- Form Requests pour toute validation (pas de validate() inline)
- Policies pour toute autorisation

## Patterns attendus
- Repository pattern si logique de requête complexe
- Jobs pour tout ce qui peut être asynchrone
- Events/Listeners pour découpler les effets de bord
- Pas de logique métier dans les Controllers

## Skills actifs dans ce contexte
`/laravel` `/debug` `/review`
