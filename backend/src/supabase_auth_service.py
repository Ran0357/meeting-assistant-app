from config import Config
import requests
from typing import Dict, Any, Tuple

class SupabaseAuthService:
    # APIリクエスト処理
    def api_request(self, method: str, path: str, data: Dict[str, Any] = None, access_token: str = None) -> Tuple[Dict[str, Any], int]:
        headers = {"apikey": Config.SUPABASE_ANON_KEY, "Content-Type": "application/json"}
        if access_token:
            headers["Authorization"] = f"Bearer {access_token}"
        url = f"{Config.SUPABASE_URL}{path}"
        try:
            if method.upper() == "POST":
                response = requests.post(url, headers=headers, json=data)
            else:
                response = requests.get(url, headers=headers)
            response.raise_for_status()
            return response.json(), response.status_code
        except requests.exceptions.HTTPError as e:
            return e.response.json(), e.response.status_code
        except requests.exceptions.RequestException as e:
            return {"error": f"Network error: {str(e)}"}, 500

    # サインアップ(メール/パスワード)
    def signup(self, email: str, password: str, redirect_to: str) -> Tuple[Dict[str, Any], int]:
        data = {"email": email, "password": password, "options": {"email_redirect_to": redirect_to}}
        return self.api_request("POST", "/auth/v1/signup", data=data)

    # ユーザ情報取得
    def get_user_by_access_token(self, access_token: str) -> Tuple[Dict[str, Any], int]:
        return self.api_request("GET", "/auth/v1/user", access_token=access_token)

    # ログイン(メール/パスワード)
    def login_with_password(self, email: str, password: str) -> Tuple[Dict[str, Any], int]:
        data = {"email": email, "password": password}
        return self.api_request("POST", "/auth/v1/token?grant_type=password", data=data)

    # ログアウト
    def logout(self, access_token: str) -> Tuple[Dict[str, Any], int]:
        return self.api_request("POST", "/auth/v1/logout", access_token=access_token)
    