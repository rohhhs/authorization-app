*** Тестовое задание на тему верификации и аунтефикации , хранения данных и применения их . Задание выполненно в формате приложения / доски задач ***

___Специальный перевод для задания . Привык писать комментарии и документацию на английском языке . ___

Структура по 3 заданию была выбрана для доски задач . Предусмотрены : 

- Регистрация , логин , редактура пользователя .
- Доступы к действиям ролей , Привязка действий к ролям , Привязка ролей к пользователям .
- Добавление , изменение , удаление задач и даже вложенных задач .
- Повышение или понижения статуса пользователя администратором группе "user" или "moderator" . 

Также добавленый функционал включает в себя : 

- Ротация токена доступа при истечении срока жизни .
- cfrtoken для Django сессий . 
- Полная запись данных пользователя в user_session для идентификации и аналитики .
- Обработка и хранение параметров в .yaml .
- Добавление специфических данных сессии в формате .json файла .

Базовый функционал 

- Редактура задач модераторов и пользователей доступна администратору . 
- Редактура задач пользователей доступна администратору и модератору .
- Доступна редактура ФИО , даты рождения , места рождения в профиле . Доступно при вводе пароля смена почты или пароля .

Функционал по задачам :

- Регистрация , вход , выход , обновление и удаление доступны каждому аккаунту . (1 задача)
- Сохранения статуса пользователя , как небольшой аналог `user_session` в таблице `user` (1 задача)
- Схема ограничения доступа заключается в добавлении и последующей идентификации прав для использования и применения после аунтификации пользователя , его ключа доступа и роли с привязанными к нею допустимыми функциями (2 задача)
- Таблица тестовыми данными заполняется при вызове api/accounts/management/commands/create_dummy_data.py
- Профиль не показывается не зерагистрированным пользователям и после 401 статуса перенаправляет на страницу входа в аккаунт . (2 задача)
- Пользователю администратору даётся возможность изменения роли пользователя и прав соответственно в сгрупированном по ролям виде (2 задача)
- Фукция добавления задачи , вывода задачи , добавление вложенной задачи (3 задача)

Запуск : 

```bash
python3 api/manage.py runserver
```

SWAGGER UI доступен по адрес (http://localhost:8000/api/docs/)
Сайт по дефолту открывается по адресу (http://localhost:8000/)

--- 

# Demo taskboard application with Python Django and PostgreSQL.

Taskboard application must to have functionality (3 Task) of task board . Users must to have availability to remove and add task . "Moderator" must to be available to remove task of "user" and "administrator" must to be available to remove tasks of "moderator" .

Demo application must to obtain (1 Task) (Registration , Authorization , Log out from the account , Delete account) . System must to obtain "is_active" state over the user to store the statuses of the user if authorizated or left from the authorizated account . 

## Account must to obtain with authorization :

1. Name , surname , patronym
2. E-mail
3. Password and password repeat

## Application must to have :

- User must to be available to change profile information
- Soft deletion of an account , when user remove account it stores "is_active=False" , but save user in database with status "is_deleted=True" and user cannot log in with password and username and account with same email cannot be created . 
- Log in and log out methods 
- Application must to have roles as Administrator , moderator and user . 
- registration must to give status of user to newly registered user
- Administrator must to be available to set users to moderator and back to user if it applied .
- Administrator page must to be over "/profile/index.html?role=administrator". Moderator is "/profile/index.html?role=moderator" and user is over "/profile/index.html?role=user" . 
- "/profile/index.html?role=administrator" must to be available rank up "user" to "moderator" and rank down "moderator" to "user" . Also need to be available to remove all "moderator" role created tasks . Also create and remove tasks of current "administrator" profile .
- "/profile/index.html?role=moderator" must to be available to remove tasks of all "user" roles . Also create and remove their tasks .  
- "/profile/index.html?role=user" must to be available to create and remove their tasks .

## Installation Instructions

### Prerequisites

- **Python 3.8+** (Python 3.9 or higher recommended)
- **PostgreSQL 12+** (database server)
- **pip** (Python package installer)
- **virtualenv** (recommended for creating isolated Python environments)

#### Summary

```bash
sudo apt update
sudo apt install -y python3 python3-pip python3-venv python3-dev
sudo apt install -y postgresql postgresql-contrib
sudo apt install -y libpq-dev gcc
sudo apt install -y build-essential
```

## Verification

```bash
sudo systemctl start postgresql
sudo systemctl enable postgresql
sudo systemctl status postgresql
python3 --version
pip3 --version
psql --version
gcc --version
```

## Git instruction

1. Fork the Repository

You need your own copy of the repository to make changes.

    Navigate to https://github.com/rohhhs/authorization-app.

    Look at the top-right corner and click the ***Fork*** button.

    Click Create Fork.

        You now have a copy at: https://github.com/YOUR-USERNAME/authorization-app

2. Generate a Personal Access Token (Crucial for Authorization)

GitHub no longer accepts account passwords for command-line operations. You must use a Token.

I . Go to GitHub Settings (top right profile icon).
II . Scroll down to Developer settings (bottom left).
III . Select Personal access tokens -> Tokens (classic).
IV . Click Generate new token (classic).
V . Scopes: Check the repo box (this gives full control of private repositories and cloning).
VI . Generate Token and COPY IT IMMEDIATELY. You will not see it again. Use this token whenever Git asks for a "password."

3. Configure Github

``` bash
git config --global user.name "Your Name"
git config --global user.email "your_email@example.com"
```

4.  Clone GitHub

```bash
git clone https://github.com/YOUR-USERNAME/authorization-app.git
```

5. Navigate into the folder 

```bash 
cd authorization-app
```

6. Stage and Commit Changes

```bash
git status
git add .
git commit -m "Detailed description of the changes made"
```

7. Push and Authorize

```bash
git push origin main
```

<!-- 
1 . Git will ask for your Username. Enter your GitHub username.
2. Git will ask for your Password. Paste the Personal Access Token you generated in Phase 1. 
-->

8. Pull

```bash
git pull origin main
```

---

## Project Instruction


```bash
cd authorization-app/api
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Two options to Configure PostgreSQL Database

#### Option A: Automated Setup (Recommended)

Run the automated database setup script:

```bash
cd authorization-app
sudo bash scripts/setup_database.sh
```

#### Option B: Manual Setup

If you prefer to set up the database manually:

1. **Set PostgreSQL Password:**

   The password has been generated and saved to `settings.yaml`. You need to set this password in PostgreSQL:

```bash
# Read the password from settings.yaml, then run:
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'your_password_from_settings_yaml';"
```

2. **Create PostgreSQL Database:**

   Log into PostgreSQL as a superuser:
```bash
sudo -u postgres psql
```

   Create a new database:
```sql
CREATE DATABASE taskboard_db;
ALTER ROLE postgres SET client_encoding TO 'utf8';
ALTER ROLE postgres SET default_transaction_isolation TO 'read committed';
ALTER ROLE postgres SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE taskboard_db TO postgres;
\q
```

3. **Configure ufw Firewall (if ufw is active):**

```bash
sudo ufw allow 5432/tcp
```

4. **Verify settings.yaml:**

   The `settings.yaml` file should already be configured with the database password. Verify it contains:

```yaml
database:
  name: taskboard_db
  user: postgres
  password: <generated_password_in_setting_yaml>
  host: localhost
  port: 5432
```

   Also update other settings as needed:
   - `admin.password`: Set a secure password for administrator account (used for dummy data)
   - `jwt.secret_key`: Generate a secure secret key for JWT tokens
   - `server.port`: Default is 8001
   - `server.debug`: Set to `False` in production

### Step 5: Run the Development Server (Simple Start) 
You can start the Django development server immediately to serve static files and view the application interface:

```bash
cd api
python manage.py runserver 8001
```

The server will start on `http://127.0.0.1:8001/` or `http://localhost:8001/`

**Note:** The server will start and serve HTML templates and static files, but full functionality (user registration, login, tasks) requires a database connection. If you see database connection errors, proceed to Step 6 to set up the database.

### Step 6: Run Database Migrations (Required for Full Functionality)

From the `api` directory, run migrations to create database tables:

```bash
python manage.py makemigrations
python manage.py migrate
```

### Step 7: Create Dummy Data (Recommended for Development)

Create test users and tasks for development and testing:

```bash
cd api
python manage.py create_dummy_data
```

This will create:
- **1 Administrator**: `admin@taskboard.local` (password from `settings.yaml` admin.password)
- **2 Moderators**: `moderator1@taskboard.local`, `moderator2@taskboard.local` (password: `moderator123`)
- **3 Regular Users**: `user1@taskboard.local`, `user2@taskboard.local`, `user3@taskboard.local` (password: `user123`)
- **Sample Tasks**: 2-3 tasks per user

To clear existing dummy data and recreate it:

```bash
python manage.py create_dummy_data --clear
```

### Step 8: Create Superuser (Optional)

Create a superuser account to access Django admin panel:

```bash
python manage.py createsuperuser
```

Follow the prompts to set up your admin account.

### Step 9: Access the Application

Open your web browser and navigate to:

- **Home page:** http://localhost:8001/
- **Registration:** http://localhost:8001/register/
- **Login:** http://localhost:8001/login/
- **Profile/Dashboard:** http://localhost:8001/profile/index.html?role=user
- **Admin Panel:** http://localhost:8001/admin/ (if superuser created)

---

## Project Structure

```
authorization-app/
├── api/                          # Django project root
│   ├── taskboard/               # Main Django project
│   │   ├── __init__.py
│   │   ├── settings.py         # Django settings (loads from settings.yaml)
│   │   ├── urls.py             # Main URL routing
│   │   ├── wsgi.py             # WSGI configuration
│   │   └── asgi.py             # ASGI configuration
│   ├── accounts/                # Authentication app
│   │   ├── __init__.py
│   │   ├── models.py           # Custom User model
│   │   ├── views.py            # Authentication views
│   │   ├── serializers.py      # DRF serializers
│   │   ├── urls.py             # Account URLs
│   │   ├── admin.py            # Django admin configuration
│   │   ├── apps.py             # App configuration
│   │   ├── middleware.py       # Custom middleware
│   │   ├── migrations/         # Database migrations
│   │   └── management/         # Management commands
│   │       └── commands/
│   │           └── create_dummy_data.py
│   ├── tasks/                   # Taskboard app
│   │   ├── __init__.py
│   │   ├── models.py           # Task model
│   │   ├── views.py            # Task views
│   │   ├── serializers.py      # Task serializers
│   │   ├── permissions.py      # Role-based permissions
│   │   ├── urls.py             # Task URLs
│   │   ├── user_urls.py        # User-specific task URLs
│   │   ├── admin.py            # Django admin configuration
│   │   ├── apps.py             # App configuration
│   │   └── migrations/         # Database migrations
│   ├── manage.py               # Django management script
│   ├── requirements.txt        # Python dependencies
│   ├── reset_database.py       # Database reset utility
│   └── reset_db.sql            # SQL reset script
├── public/                      # Templates and static files
│   ├── base.html               # Base template
│   ├── index.html              # Home page
│   ├── accounts/               # Authentication templates
│   │   ├── login.html
│   │   └── register.html
│   ├── profile/                # Profile templates
│   │   └── index.html
│   ├── task/                   # Task templates
│   │   └── index.html
│   └── asset/                  # Static files (CSS, JS, images)
│       ├── css/
│       │   ├── style.css
│       │   ├── auth.css
│       │   └── profile.css
│       ├── js/
│       │   ├── auth.js
│       │   ├── tasks.js
│       │   ├── profile.js
│       │   ├── admin.js
│       │   ├── public-tasks.js
│       │   └── task-list.js
│       └── images/              # Image assets
├── scripts/                     # Setup and utility scripts
│   └── setup_database.sh
├── settings.yaml                # Configuration file
└── README.md                    # Main documentation

---

## Simple database test

```bash
sudo -u postgres psql
```

```sql
\l
\c taskboard_db
\dt
```

---

# RUN SERVER 1ST TIME

```bash
cd api
source venv/bin/activate
python manage.py migrate
python manage.py create_dummy_data
python manage.py runserver 8001
```

# RUN SERVER SECONDARY

```bash
cd api
python manage.py runserver
```