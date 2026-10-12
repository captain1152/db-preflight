# DB Preflight

**AI 코딩 워크플로를 위한, 근거 중심의 PostgreSQL / Prisma ORM 7 진단 도구.**

DB Preflight는 Prisma 스키마와 실제 PostgreSQL DB 구조를 비교해 관계·유일성·매핑 불일치를 **근거와 함께**
(Prisma `파일:줄:열` + 관련 DB 객체) 보고합니다. `prisma validate`가 P1012로 거부하는 스키마도 분석합니다.
DB와 Prisma 파일은 절대 변경하지 않습니다. 목적은 "AI가 DB를 알아서 고친다"가 아니라, 사람이든 AI든
무언가를 고치기 **전에** 실제 상태를 확인해 잘못된 자동 수정을 피하도록 검증 가능한 근거를 주는 것입니다.

[English README](README.md) · [문서 목록](docs/index.md) · [규칙](docs/rules.md) · [보안](docs/security.md) ·
[호환성](docs/compatibility.md)

> 상태: v0.1.0. npm·마켓플레이스에 아직 게시되지 않았습니다. 아래 명령은 로컬 빌드 또는 플러그인 폴더에서
> 실행합니다. `npx db-preflight`는 **아직 동작하지 않습니다.**

## 첫 실행 (DB·Docker·네트워크 불필요)

요구사항: Node.js 20.19 이상, 소스 빌드 시 pnpm.

```powershell
pnpm install --frozen-lockfile
pnpm build
node dist/db-preflight.cjs demo
```

데모는 내장된 **합성(synthetic)** 데이터를 사용합니다. `[organizationId, month, snapshotId]` 복합 1:1 관계에
유일성 선언이 없고, DB의 해당 FK 조합도 유일하지 않은 사례입니다. **데모는 의도적으로 종료 코드 1**
("불일치 발견")로 끝납니다. 이것은 데모의 정상 결과이며 실행 실패가 아닙니다. 실행 오류·잘못된 입력은 2입니다.

실제 출력: [텍스트](docs/examples/demo-output.txt), [JSON](docs/examples/demo-report.json),
[Markdown](docs/examples/demo-report.md). 흐름은 **고장 난 복합 관계 → 진단 → 근거 → 사람이 결정할 사항**
(업무상 1:1인가 1:N인가? 중복 데이터가 이미 있는가? 마이그레이션이 안전한가?)이며, 이 결정은 도구가 대신하지 않습니다.

`node dist/db-preflight.cjs demo --scenario healthy`는 수정된 버전입니다(종료 코드 0).

## `prisma validate`, SQL 도구와의 차이

- **오류 스키마 분석**: P1012가 나는 스키마도 위치 정보와 함께 계속 분석합니다.
- **실제 DB 대조**: 고정된 카탈로그 조회로 DB 구조를 확인하고 finding마다 근거를 붙입니다.
- **"Prisma가 허용"과 "DB가 보장"을 분리**: DBP001(Prisma 선언) vs DBP002/DBP005(DB 보장).
- **검사하지 않은 것을 명시**: `unknown` 검사, coverage, 종료 코드 3.
- **DB 변경 없음**: 임의 SQL 입력·자동 마이그레이션·자동 수정 기능이 없습니다.

## 사용법

```text
db-preflight demo [--scenario broken|healthy] [--format text|json|markdown] [--out FILE] [--force]
db-preflight scan --schema PATH --snapshot FILE [--default-schema NAME] [--schemas a,b] [--format F] [--out FILE]
db-preflight scan --schema PATH --live --schemas a,b [--db-url-env NAME] [--default-schema NAME] [--timeout-ms N]
db-preflight snapshot --live --schemas a,b [--db-url-env NAME] [--out FILE]
```

- `--schema`: `.prisma` 파일 또는 디렉터리(여러 파일, 결정적 순회; `node_modules`, `.git`, 빌드 출력, symlink 제외).
  실행 가능한 `prisma.config.*`는 로드·실행하지 않으므로 스키마 경로를 항상 명시합니다.
- `--default-schema`: `@@schema`가 없는 모델의 DB 스키마. 추측하지 않으며, 없으면 해당 검사는 `unknown`입니다.
  검사 범위인 `--schemas`와는 다른 옵션입니다.
- `--format json`: stdout에 JSON 문서 하나만 출력합니다([report 계약](schemas/report.schema.json)). 진행·오류 메시지는 stderr.
- `--out FILE`: 기존 파일은 `--force` 없이는 덮어쓰지 않고, `--force`여도 Prisma 입력·`.prisma`·입력 snapshot·symlink·하드링크에는 쓰지 않습니다.

### 종료 코드

| 코드 | 의미 |
|---|---|
| 0 | 범위 내 필요한 검사가 완료되었고 실패한 규칙이 없음 |
| 1 | 하나 이상의 확인된 불일치(coverage가 불완전할 수 있으며 report에 표시) |
| 2 | 입력·설정·연결·실행 오류로 유효한 결과 없음 |
| 3 | 확인된 불일치는 없지만 필요한 검사가 `unknown`이라 결론을 낼 수 없음 |

`unknown`은 "평가하지 않음"입니다(미지원 문법, 불완전 수집, `--default-schema` 누락, view, implicit many-to-many,
partial/expression 인덱스 등). 통과로 집계하지 않습니다.

### Live 검사 (명시적 동의 필요)

live 모드는 최소권한 계정으로 `pg_catalog` 메타데이터만 읽습니다. 접속 URL은 본인 셸에서 환경변수로 설정합니다.
DB Preflight는 `.env`를 읽지 않고, 명령줄로 URL을 받지 않으며, `DATABASE_URL`이나 `PG*` 변수로 대체하지 않습니다.

PowerShell:

```powershell
$env:DB_PREFLIGHT_DATABASE_URL = "postgresql://preflight_reader:<password>@db.example.com:5432/app"
node dist/db-preflight.cjs scan --schema .\prisma\schema --live --schemas public,reporting --default-schema public
node dist/db-preflight.cjs snapshot --live --schemas public,reporting --out .\db-snapshot.json
Remove-Item Env:\DB_PREFLIGHT_DATABASE_URL
```

Bash:

```bash
export DB_PREFLIGHT_DATABASE_URL='postgresql://preflight_reader:<password>@db.example.com:5432/app'
node dist/db-preflight.cjs scan --schema ./prisma/schema --live --schemas public,reporting --default-schema public
unset DB_PREFLIGHT_DATABASE_URL
```

원격 호스트는 기본적으로 인증서 검증 TLS를 사용합니다(`sslmode=require`도 `verify-full`로 처리). superuser 연결은
거부합니다. 계정 설정·TLS·"읽기 전용"의 의미와 한계는 [보안 문서](docs/security.md)를 보세요. snapshot과 report는
스키마 메타데이터를 담고 있어 민감할 수 있으므로 기본적으로 Git에서 제외됩니다. snapshot 결과는 수집 시점의 상태이며
현재 DB 상태라고 단정하지 않습니다.

## 검사 규칙 (v0.1)

| 규칙 | 내용 |
|---|---|
| DBP001 | 1:1 관계에 맞는 Prisma 유일성 선언 없음(P1012), 복합키 포함 |
| DBP002 | Prisma `@id/@@id/@unique/@@unique`가 DB의 PK/UNIQUE/유일 인덱스(같은 컬럼 또는 부분집합)로 보장되지 않음 |
| DBP003 | `@@schema`, `@@map`, `@map` 적용 후 테이블·컬럼 없음 |
| DBP004 | FK 없음 또는 컬럼 대응이 다름(`relationMode = "foreignKeys"`; `"prisma"`에서는 해당 없음) |
| DBP005 | 1:1 관계의 참조 컬럼 조합이 DB에서 유일하지 않음(구조상 중복 허용) |
| DBP006 | scalar 필드의 선택성과 컬럼 nullable 불일치(relation 필드 선택성으로 추정하지 않음) |

자세한 내용: [docs/rules.md](docs/rules.md). 통합 테스트로 검증한 버전: PostgreSQL 16, 18(14 이상은 수집기가
허용하지만 미검증). Prisma는 ORM **7** 의미론만 지원합니다.

**정상 결과는 "지원하고 수행한 검사에서 불일치 없음"입니다.** DB 전체가 정상이라거나, 데이터가 일관적이라거나,
마이그레이션이 안전하다는 뜻이 아닙니다.

## Claude Code 플러그인

[`plugins/claude/db-preflight`](plugins/claude/db-preflight)의 플러그인은 얇은 인터페이스입니다. skill이 플러그인 폴더에
포함된 같은 CLI 번들(`dist/db-preflight.cjs`)을 실행하고 JSON report를 설명합니다. 진단 로직을 따로 갖지 않습니다.

```powershell
claude --plugin-dir ./plugins/claude/db-preflight
# Claude Code 안에서:
/db-preflight:scan demo
/db-preflight:scan --schema ./prisma/schema --snapshot ./db-snapshot.json --default-schema public
/db-preflight:explain ./report.json
```

Claude가 읽은 report 내용(스키마·테이블·컬럼 이름)은 대화 문맥에 포함됩니다. CLI 자체는 외부 전송을 하지 않지만,
그것이 "Claude가 로컬에서만 처리한다"는 뜻은 아닙니다. 검증 상태는 [publishing 문서](docs/publishing.md)에 정리했습니다.

## 개발

[docs/development.md](docs/development.md): `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`,
`pnpm test:package`, `pnpm test:prisma`, `pnpm test:integration`(Docker 필요).

## 라이선스

MIT([LICENSE](LICENSE), 저작권자 이성민). 번들된 서드파티 라이선스: `dist/THIRD_PARTY_LICENSES.txt`.
