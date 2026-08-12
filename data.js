const DemoData = (() => {
  const PERIODS = [
    {n:1,start:"07:40",end:"08:20"},{n:2,start:"08:25",end:"09:05"},{n:3,start:"09:20",end:"10:00"},
    {n:4,start:"10:05",end:"10:45"},{n:5,start:"10:50",end:"11:30"},{n:6,start:"13:15",end:"13:55"},
    {n:7,start:"14:00",end:"14:40"},{n:8,start:"14:55",end:"15:35"},{n:9,start:"15:40",end:"16:20"}
  ];
  const DOW = ["Thứ 2","Thứ 3","Thứ 4","Thứ 5","Thứ 6"];

  function iso(d){ return d.toISOString().slice(0,10); }
  function addDays(d,n){ const x=new Date(d); x.setUTCDate(x.getUTCDate()+n); return x; }
  function buildWeeks(){
    const start = new Date("2026-08-03T00:00:00Z");
    const end = new Date("2027-05-31T00:00:00Z");
    const weeks=[]; let i=1, cursor=start;
    const today=iso(new Date());
    while(cursor<=end){
      const friday=addDays(cursor,4);
      const startDate=iso(cursor), endDate=iso(friday);
      weeks.push({
        id:"w"+i, number:i, startDate, endDate,
        status:startDate<=today&&endDate>=today?"open":(endDate<today?"locked":"upcoming"),
        deadlineMode:"week_before_20",
        deadline:iso(addDays(cursor,-1))+"T20:00",
        note:""
      });
      cursor=addDays(cursor,7); i++;
    }
    return weeks;
  }
  function defaultState(){
    const users=[
      {id:"t1",code:"GV01",name:"Nguyễn Văn An",email:"gv@demo.vn",role:"teacher",active:true},
      {id:"m1",code:"CS01",name:"Trần Quốc Bảo",email:"cansu@demo.vn",role:"monitor",active:true},
      {id:"s1",code:"HS01",name:"Nguyễn Minh Anh",email:"hs01@demo.vn",role:"student",active:true},
      {id:"s2",code:"HS02",name:"Lê Ngọc Hà",email:"hs02@demo.vn",role:"student",active:true},
      {id:"s3",code:"HS03",name:"Phạm Gia Huy",email:"hs03@demo.vn",role:"student",active:true},
      {id:"s4",code:"HS04",name:"Võ Hoàng Nam",email:"hs04@demo.vn",role:"student",active:true},
      {id:"s5",code:"HS05",name:"Huỳnh Trâm Anh",email:"hs05@demo.vn",role:"student",active:true},
      {id:"s6",code:"HS06",name:"Đỗ Minh Khang",email:"hs06@demo.vn",role:"student",active:true},
      {id:"s7",code:"HS07",name:"Bùi Thảo Vy",email:"hs07@demo.vn",role:"student",active:true},
      {id:"s8",code:"HS08",name:"Ngô Đức Anh",email:"hs08@demo.vn",role:"student",active:true},
      {id:"s9",code:"HS09",name:"Trần Khánh Linh",email:"hs09@demo.vn",role:"student",active:true},
      {id:"s10",code:"HS10",name:"Mai Quốc Việt",email:"hs10@demo.vn",role:"student",active:true}
    ];
    const schedule=[
      {dow:1,period:2},{dow:3,period:7},{dow:4,period:4}
    ];
    const regs=[
      {id:"r1",studentId:"s1",weekId:"w1",dow:1,period:2,content:"Ôn tập môn Toán",note:"Ôn chương 2: phương trình và bất phương trình",status:"approved",teacherComment:"Nội dung rõ ràng, tiếp tục phát huy.",updatedAt:Date.now()-300000},
      {id:"r2",studentId:"s1",weekId:"w1",dow:3,period:7,content:"Ôn tập môn Sinh học",note:"Đọc bài 15 và làm câu hỏi SGK",status:"submitted",teacherComment:"",updatedAt:Date.now()-240000},
      {id:"r3",studentId:"s2",weekId:"w1",dow:1,period:2,content:"Luyện bài tập Tiếng Anh",note:"Unit 1 - Vocabulary",status:"approved",teacherComment:"",updatedAt:Date.now()-220000},
      {id:"r4",studentId:"s2",weekId:"w1",dow:3,period:7,content:"Đọc sách Ngữ văn",note:"Đọc tác phẩm và ghi ý chính",status:"approved",teacherComment:"",updatedAt:Date.now()-210000},
      {id:"r5",studentId:"s2",weekId:"w1",dow:4,period:4,content:"Ôn Vật lí",note:"Làm bài tập 1-6",status:"needs_revision",teacherComment:"Em ghi cụ thể bài/chủ đề cần ôn nhé.",updatedAt:Date.now()-200000},
      {id:"r6",studentId:"s3",weekId:"w1",dow:1,period:2,content:"Ôn tập môn Toán",note:"Làm bài tập 1,2,3 trang 45",status:"needs_revision",teacherComment:"Bổ sung mục tiêu cần đạt.",updatedAt:Date.now()-180000},
      {id:"r7",studentId:"s3",weekId:"w1",dow:4,period:4,content:"Ôn tập môn Văn",note:"Đọc và tóm tắt truyện ngắn",status:"submitted",teacherComment:"",updatedAt:Date.now()-170000},
      {id:"r8",studentId:"s4",weekId:"w1",dow:1,period:2,content:"Luyện Hóa học",note:"Bài tập cân bằng phản ứng",status:"approved",teacherComment:"",updatedAt:Date.now()-160000},
      {id:"r9",studentId:"s5",weekId:"w1",dow:1,period:2,content:"Ôn Tin học",note:"Thuật toán và sơ đồ khối",status:"approved",teacherComment:"",updatedAt:Date.now()-150000},
      {id:"r10",studentId:"s5",weekId:"w1",dow:3,period:7,content:"Luyện Toán",note:"Bài tập chương 1",status:"approved",teacherComment:"",updatedAt:Date.now()-140000}
    ];
    return {
      version:1,
      settings:{className:"10A1",schoolYear:"2026–2027",announcement:"Chuẩn bị nội dung tự học trước deadline của từng tuần/buổi.",teacherName:"Nguyễn Văn An",smartApprovalEnabled:true},
      users, weeks:buildWeeks(), periods:PERIODS, schedule, overrides:[], registrations:regs,
      notifications:[],
      currentWeekId:"w1",
      audit:[]
    };
  }
  return { PERIODS,DOW,defaultState };
})();
