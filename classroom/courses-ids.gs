function listClassroomCourseIds() {
  const optionalArgs = {
    pageSize: 50,
    courseStates: ['ACTIVE']
  };

  const response = Classroom.Courses.list(optionalArgs);
  const courses = response.courses;

  if (!courses || courses.length === 0) {
    Logger.log('Nessun corso trovato.');
  } else {
    Logger.log('Corsi trovati:');
    courses.forEach(course => {
      Logger.log(`📘 ${course.name} → ID: ${course.id}`);
    });
  }
}
