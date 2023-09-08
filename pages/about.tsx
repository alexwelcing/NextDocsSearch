import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import CircleNav from '@/components/ui/CircleNav';
import PDFLinks from '@/components/PDFLinks';


const About: React.FC = () => {
  const [pdfFiles, setPdfFiles] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/getPDFs')
      .then((res) => res.json())
      .then((data) => setPdfFiles(data.pdfFiles));
  }, []);

  return (
    <div className="siteContainer">
      <Head>
        <title>About Alex Welcing | Product Leadership | New York, Remote US</title>
        <meta
          name="description"
          content="Alex Welcing is a Senior Technical Product Manager with 10+ years of experience in the tech industry. He is passionate about building products that solve real problems and make a difference in the world. Alex is based in New York City, but is open to remote opportunities in the US."
        />
      </Head>

      <header className="header">
        <CircleNav />
      </header>

      <main className="contentContainer">
        <section className="shadow-lg p-8 rounded-lg space-y-4">
          <article className="bg-slate-800 opacity-80 shadow-lg p-4 rounded-lg">
            <h1 className="text-white text-3xl mb-4">Alex Welcing | Senior Technical Product Manager</h1>
            <p className="text-2xl text-slate-100 mb-4 leading-tight">
              Results-oriented leader, adept in defining product enhancements, prioritizing crucial
              features, and delivering solutions that directly address market challenges and meet
              customers’ ever-evolving needs. Recognized success creating strategic products and
              aligning with overall business objectives and market opportunities.
            </p>
          </article>

          <article className="bg-slate-800 opacity-80 shadow-lg p-4 rounded-lg text-2xl text-slate-100 leading-tight space-y-2">
            <p>
              Skilled at driving business growth by managing and launching business-defining projects like:
            </p>
            <ol>
              <li>
                <span className="material-icons-outlined align-middle mr-2">vrpano</span>
                VR commerce experiences
              </li>
              <li>
                <span className="material-icons-outlined align-middle mr-2">gavel</span>
                SaaS legal analysis
              </li>
              <li>
                <span className="material-icons-outlined align-middle mr-2">smart_toy</span>
                AI-enabled ads for publishers
              </li>
              <li>
                <span className="material-icons-outlined align-middle mr-2">memory</span>
                Digital content management
              </li>
            </ol>
            <p className="text-2xl text-slate-100 leading-tight space-y-2">
              Leading teams with excellence, and utilizing market insights to position
              products strategically and effectively.
            </p>
          </article>

          <article className="bg-white shadow-lg p-8 rounded-lg">
  {pdfFiles.length > 0 && (
    <div className="pdf-section mb-4">
      <h4 className="text-slate-700 text-2xl font-semibold leading-tight text-primary space-y-4">Resumes in PDF</h4>
      <div className="grid grid-cols-1 md:grid-cols-1 gap-4 mt-2">

      <div className="pdf-button-container">
        <PDFLinks files={pdfFiles} />
      </div>
      </div>
    </div>
  )}
</article>

            {/* ...Core Competencies Section... */}
            <article className="bg-white shadow-lg p-8 rounded-lg space-y-4">
              <h4 className="text-slate-700 text-2xl font-semibold leading-tight text-primary space-y-4">
                Core Competencies
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                <div className="flex text-xl items-center space-x-2 p-2 bg-blue-100 rounded hover:bg-blue-200 transition">
                  <span className="material-icons-outlined">build</span>
                  <span>Product Development</span>
                </div>
                <div className="flex text-xl items-center space-x-2 p-2 bg-green-100 rounded hover:bg-green-200 transition">
                  <span className="material-icons-outlined">group_work</span>
                  <span>Strategic Partnerships</span>
                </div>
                <div className="flex text-xl items-center space-x-2 p-2 bg-purple-100 rounded hover:bg-purple-200 transition">
                  <span className="material-icons-outlined">emoji_people</span>
                  <span>Consumer Experience</span>
                </div>
                <div className="flex text-xl items-center space-x-2 p-2 bg-yellow-100 rounded hover:bg-yellow-200 transition">
                  <span className="material-icons-outlined">leaderboard</span>
                  <span>Team Leadership</span>
                </div>
                <div className="flex text-xl items-center space-x-2 p-2 bg-red-100 rounded hover:bg-red-200 transition">
                  <span className="material-icons-outlined">code</span>
                  <span>Software Development</span>
                </div>
                <div className="flex text-xl items-center space-x-2 p-2 bg-indigo-100 rounded hover:bg-indigo-200 transition">
                  <span className="material-icons-outlined">analytics</span>
                  <span>Data Analytics</span>
                </div>
                <div className="flex text-xl items-center space-x-2 p-2 bg-pink-100 rounded hover:bg-pink-200 transition">
                  <span className="material-icons-outlined">event_note</span>
                  <span>Project Management</span>
                </div>
                <div className="flex text-xl items-center space-x-2 p-2 bg-teal-100 rounded hover:bg-teal-200 transition">
                  <span className="material-icons-outlined">add_task</span>
                  <span>Strategic Planning</span>
                </div>
                <div className="flex text-xl items-center space-x-2 p-2 bg-gray-100 rounded hover:bg-gray-200 transition">
                  <span className="material-icons-outlined">psychology</span>
                  <span>Critical Problem Solving</span>
                </div>
              </div>
            </article>

            {/* ...Professional Experience Section... */}
            <article className="bg-white shadow-lg p-8 rounded-lg space-y-4">
              <h4 className="text-slate-700 mb-2 mt-0 text-2xl font-semibold leading-tight text-primary space-y-2">
                Professional Experience
              </h4>
                {' '}
                {/* OBSESS VR Experience */}
                <div>
                  <h5 className="text-blue-700 mb-2 mt-0 text-xl font-medium leading-tight text-primary">
                    ObsessVR • Product Manager @ 360 Visual Commerce Startup
                  </h5>
                  <h6 className="font-medium leading-tight">New York | 2022-2023</h6>
                  <p>
                    Defined product enhancements, prioritized essential features, and delivered products
                    that addressed market challenges and met customer needs by liaising with customers,
                    engineering, marketing, and customer success teams.
                  </p>
                  <ul className="list-disc pl-5">
                    <li>
                      Succeeded in launching cutting-edge SaaS platform features by leveraging open-source
                      development, large-language models for code, and generative AI to rapidly create
                      working prototypes.
                    </li>
                    <li>
                      Enhanced consumer product and team experience by demonstrating exceptional
                      leadership.
                    </li>
                    <li>
                      Optimized marketing data pipeline by re-writing implementation of the Google
                      Analytics 4 API.
                    </li>
                    <li>
                      Played a pivotal role in product development of Real-Time 3D rendering, enabling
                      users to move animated characters in three-dimensional spaces.
                    </li>
                  </ul>
                </div>
              </article>
              <div className=" bg-white shadow-lg p-8 rounded-lg">
                {/* Manatt, Phelps, & Phillips Experience */}
                <div>
                  <h5 className="text-blue-700 mb-2 mt-0 text-xl font-medium leading-tight text-primary">
                    Manatt, Phelps, & Phillips • Developer @ AmLaw 200 Firm
                  </h5>
                  <h6 className="font-medium leading-tight">New York | 2019-2022</h6>
                  <p>
                    Led the transformation of innovative ideas into practical applications by offering
                    specialized technical expertise and actively participated in hands-on development and
                    design.
                  </p>
                  <ul className="list-disc pl-5">
                    <li>
                      Steered developing and deploying a proprietary SaaS platform that provided secure
                      content access to legal and regulatory analysis, offering clients a reliable and
                      trusted source for critical information.
                    </li>
                    <li>
                      Developed an AI document scanning and image selection system for publication,
                      resulting in significant time savings for consultants, enhanced accuracy of the
                      product knowledge graph, and elimination of human error.
                    </li>
                    <li>
                      Empowered decision-makers to make informed strategic choices and stay ahead in the
                      dynamic healthcare landscape by generating in-depth data analysis content tailored
                      for executive leadership.
                    </li>
                    <li>
                      Built and maintained firm-wide knowledge and training portal, delivering
                      extraordinary ROI with minimal operating and development costs.
                    </li>
                  </ul>
                </div>
              </div>
              <div className=" bg-white shadow-lg p-8 rounded-lg space-y-8">
                {/* MANATT Experience */}
                <div>
                  <h5 className="text-blue-700 mb-2 mt-0 text-xl font-medium leading-tight text-primary">
                    Manatt Health • Consultant @ Healthcare Legal Practice
                  </h5>
                  <h6 className="font-medium leading-tight">New York | 2017-2019</h6>
                  <p>
                    Crafted and launched a client-exclusive publishing SaaS platform, propelling it from
                    its beta phase to an impressive achievement of generating millions in Annual Recurring
                    Revenue (ARR).
                  </p>
                  <ul>
                    <li>
                      Supported internal executives to understand how customers interacted with the
                      product by conducting thorough data analysis.
                    </li>
                    <li>
                      Oversaw all aspects of publication data reporting, security, and service monitoring,
                      providing recurring reporting on site health and opportunities for user experience
                      improvements.
                    </li>
                    <li>
                      Managed publication operations, including regulatory summaries, 50 state policy
                      interactive visualizations, and weekly analysis.
                    </li>
                  </ul>
                </div>
              </div>
              <div className=" bg-white shadow-lg p-8 rounded-lg space-y-8">
                {/* ARKADIUM Experience */}
                <div>
                  <h5 className="text-blue-700 mb-2 mt-0 text-xl font-medium leading-tight text-primary">
                    Arkadium • Partner Development @ AdTech SaaS{' '}
                  </h5>
                  <h6 className="font-medium leading-tight">New York | 2016-2017</h6>
                  <p>
                    Spearheaded the end-to-end business development process, securing valuable artificial
                    intelligence partnerships with top digital publishers.
                  </p>
                  <ul className="list-disc pl-5">
                    <li>
                      Introduced an ingenious NLP-driven interactive advertising content solution
                      specifically designed for publishers by leveraging expertise in new business
                      development.
                    </li>
                    <li>
                      Pioneered the development of groundbreaking AI partnerships by leveraging NLP
                      contextual understanding to create interactive content.
                    </li>
                  </ul>
                </div>
              </div>

            {/* ...Education Section... */}
            <article className="bg-white shadow-lg p-8 rounded-lg space-y-2">
              <h5 className="text-pink-700 mb-2 mt-0 text-xl font-medium leading-tight text-primary">
                Education
              </h5>
              <h6 className="font-medium leading-tight">
                Bachelor of Science in Marketing, 2010-2013 <br />
                University of Texas at Dallas <br />
                Naveen Jindal School of Management
              </h6>
            </article>
          </section>
        </main>
      </div>
    );
};

export default About;
