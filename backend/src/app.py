from config import Config
from flask import Flask
from flask.wrappers import Response as ResponseBase
from flask_cors import CORS
from routes_auth import bp_auth
from supabase_auth_filter import auth_filter

# Flaskアプリケーション初期化
app = Flask(__name__, static_folder="static", static_url_path="")
CORS(   
    app,
    resources={r"/api/*":  {"origins": "*"}},
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers="*",
    supports_credentials=True
)
app.register_blueprint(bp_auth)
app.before_request(auth_filter)

@app.route("/api/protected")
def protected():
    # auth_filter で g.user_id がセットされているはず
    if not getattr(g, "user_id", None):
        return jsonify({"error": "Unauthorized"}), 401

    return jsonify({
        "message": "認証済みユーザーのみアクセスできます",
        "user_id": g.user_id
    })

    
# アプリケーションの実行
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=Config.SERVER_PORT, debug=True)