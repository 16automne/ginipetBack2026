const express = require('express');
const app = express();
const port = 9070;
const jwt = require('jsonwebtoken'); //jwt 라이브러리
const SECRET_KEY = 'test1234'; //Secret Key


// [필수] 1. bcrypt 라이브러리 불러오기
const bcrypt = require('bcrypt');
const cors = require('cors');

// [필수] 2. JSON 파싱 미들웨어 추가 (이게 없으면 req.body가 비어있게 됩니다)
app.use(cors());
app.use(express.json());

const mysql = require('mysql');
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '1234',
  database: 'kdt'
});

connection.connect((err) => {
  if (err) {
    console.log('MYSQL 연결 실패 : ', err);
    return;
  }
  console.log('MYSQL 연결 성공');
});

// [수정된 회원가입 로직]
app.post('/ginipet_register', async (req, res) => {
  // 프론트에서 보낸 데이터 받기
  const { username, password, email, tel } = req.body;

  try {
    // 비밀번호 암호화
    const hash = await bcrypt.hash(password, 10);
    
    // SQL 쿼리문 (데이터 4개: username, hash, email, tel)
    const sql = `INSERT INTO ginipet_users (username, password, email, tel) VALUES (?, ?, ?, ?)`;

    connection.query(sql, [username, hash, email, tel], (err, results) => {
      if (err) {
        console.error('DB 저장 오류:', err);
        return res.status(500).json({ error: 'DB 저장 실패' });
      }
      res.json({ message: '회원가입 성공' });
    });
  } catch (err) {
    console.error('서버 에러:', err);
    res.status(500).send('서버 내부 오류');
  }
});

app.listen(port, () => {
  console.log(`서버 대기중 : http://localhost:${port}`);
});

// 모든 사용자 정보 조회
app.get('/ginipet', (req, res) => {
  const sql = 'SELECT * FROM ginipet_users ORDER BY id DESC';
  connection.query(sql, (err, results) => {
    if (err) {
      console.log('조회 오류 : ', err);
      return res.status(500).json({ error: 'DB 조회 실패' });
    }
    res.json(results); // 성공 시 배열 형태로 데이터 반환
  });
});

// 특정 사용자 상세 조회 (id 기준)
app.get('/ginipet/:id', (req, res) => {
  const { id } = req.params;
  const sql = 'SELECT * FROM ginipet_users WHERE id = ?';
  connection.query(sql, [id], (err, result) => {
    if (err) return res.status(500).json({ error: '데이터 조회 실패' });
    if (result.length === 0) return res.status(404).json({ error: '사용자를 찾을 수 없음' });
    
    res.json(result[0]); // 단일 객체로 반환
  });
});

// 아이디 중복 조회
app.post('/check-username', (req, res) => {
  const {username} = req.body;
  const sql = 'SELECT * FROM ginipet_users WHERE username=?';
  connection.query(sql, [username], (err, result)=>{
    if (err) return res.status(500).send(err);
        if (result.length > 0) {
            res.json({ exists: true }); // 아이디 있음
        } else {
            res.json({ exists: false }); // 아이디 없음(사용 가능)
        }
    });
})

// 로그인처리
app.post('/ginipet_login', (req, res) => {
  // 프론트엔드에서 body태그에 정보를 넘겨받아 저장
  const { username, password } = req.body;
  const sql = 'SELECT * FROM ginipet_users WHERE username=?';

  connection.query(sql, [username], async(err, result)=>{
    if(err||result.length==0){
      return res.status(401).json({
        error: '아이디 혹은 비밀번호 불일치'
      });
    }

    const user = result[0];
    const isMatch = await bcrypt.compare(password, user.password); // 비번일치 검사

    if(!isMatch){
      return res.status(401).json({error: '아이디 혹은 비밀번호 불일치'})
    }

    // 토큰 1시간 생성
    const token = jwt.sign({id: user.id, username: username}, SECRET_KEY, {
      expiresIn: '1h'
    });
    // 토큰 발급
    res.json({token});
  })
})
