require 'rake'

TARGETS = Dir['src/*{[!min]}.js'].map do |source|
  file source.pathmap('dist/%n.min%x') => source do |t|
    sh "uglifyjs #{t.source} -o #{t.name} --mangle --compress"
  end.name
end

task default: :minify

desc 'minify source files'
task minify: TARGETS
